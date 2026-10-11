import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

// Static route/callsite inventory. It never reads application configuration or secrets.
const frontend = path.resolve(import.meta.dirname, '..')
const backend = path.resolve(process.argv[2] || path.join(frontend, '../Backend-Agrisage'))
const walk = (dir, test) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), test) : test(e.name) ? [path.join(dir, e.name)] : [])
const slash = s => s.replaceAll('\\', '/')
const relative = (base, p) => slash(path.relative(base, p))
const line = (s, pos) => s.slice(0, pos).split('\n').length
const normalize = route => route.split('?')[0].replace(/\{[^}]+\}/g, '{}').replace(/\/+$/, '')
const endpoints = []
for (const file of walk(path.join(backend, 'src/AgriSage.Api'), n => n.endsWith('Controller.cs'))) {
  const source = fs.readFileSync(file, 'utf8')
  const classes = [...source.matchAll(/public (?:sealed )?class (\w+Controller)\b/g)]
  for (let c = 0; c < classes.length; c++) {
    const cm = classes[c]
    const prelude = source.slice(source.lastIndexOf('\n}', cm.index) + 2, cm.index)
    const routeBase = /\bRoute\("([^"]+)"\)/.exec(prelude)?.[1] || ''
    const roles = /\bAuthorize(?:\(Roles = ([^)]+)\))?/.exec(prelude)?.[1] || (/\bAuthorize/.test(prelude) ? 'Authenticated' : 'Anonymous')
    const end = classes[c + 1]?.index ?? source.length
    const body = source.slice(cm.index, end)
    for (const hm of body.matchAll(/\bHttp(Get|Post|Put|Patch|Delete)(?:\("([^"]*)"\))?/g)) {
      const pos = cm.index + hm.index
      const actionAttributes = source.slice(source.lastIndexOf('public ', pos) + 7, source.indexOf('public ', pos))
      const actionRoles = /\bAuthorize(?:\(Roles = ([^)]+)\))?/.exec(actionAttributes)?.[1]
      const suffix = hm[2] || ''
      const route = '/' + ((suffix.startsWith('api/') || suffix.startsWith('/')) ? suffix.replace(/^\//, '') : [routeBase, suffix].filter(Boolean).join('/'))
      endpoints.push({ method: hm[1].toUpperCase(), route, normalized: normalize(route), controller: cm[1], file: relative(backend, file), line: line(source, pos), roles: /\bAllowAnonymous/.test(actionAttributes) ? 'Anonymous' : actionRoles || roles })
    }
  }
}

const sources = new Map(walk(path.join(frontend, 'src'), n => /\.tsx?$/.test(n)).map(file => [file, ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)]))
const resolveImport = (file, spec) => {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null
  const base = spec.startsWith('@/') ? path.join(frontend, 'src', spec.slice(2)) : path.resolve(path.dirname(file), spec)
  return [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(p => sources.has(p))
}
const reachable = new Set()
function markReachable(file) {
  if (!file || reachable.has(file)) return
  reachable.add(file)
  const visit = n => {
    if (ts.isImportDeclaration(n) || (ts.isExportDeclaration(n) && n.moduleSpecifier)) markReachable(resolveImport(file, n.moduleSpecifier.text))
    if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(n.arguments[0])) markReachable(resolveImport(file, n.arguments[0].text))
    ts.forEachChild(n, visit)
  }
  const source = sources.get(file)
  if (source) visit(source)
}
markReachable(path.join(frontend, 'src/main.tsx'))
const references = new Map()
const helperReferences = new Map()
for (const [file, source] of sources) {
  if (file.includes(path.sep + 'api' + path.sep) || !reachable.has(file)) continue
  const visit = n => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      const entries = helperReferences.get(n.expression.text) || []
      entries.push(relative(frontend, file) + ':' + (source.getLineAndCharacterOfPosition(n.getStart()).line + 1))
      helperReferences.set(n.expression.text, entries)
    }
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      const key = n.expression.text + '.' + n.name.text
      const entries = references.get(key) || []
      entries.push(relative(frontend, file) + ':' + (source.getLineAndCharacterOfPosition(n.getStart()).line + 1))
      references.set(key, entries)
    }
    // CreditPanel chooses one of these three methods from its typed state.
    if (ts.isElementAccessExpression(n) && n.expression.getText(source) === 'customerCreditApi' && n.argumentExpression.getText(source) === 'prompt') {
      for (const method of ['activate', 'suspend', 'block']) {
        const key = 'customerCreditApi.' + method
        const entries = references.get(key) || []
        entries.push(relative(frontend, file) + ':' + (source.getLineAndCharacterOfPosition(n.getStart()).line + 1))
        references.set(key, entries)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
}
// Follow named exported helpers used by routed screens, e.g. searchAiModels -> aiModelsApi.list.
for (const [file, source] of sources) {
  if (!file.includes(path.sep + 'api' + path.sep) || !reachable.has(file)) continue
  const visit = n => {
    if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)) {
      let parent = n.parent
      while (parent && !ts.isFunctionDeclaration(parent)) parent = parent.parent
      if (parent?.name && helperReferences.has(parent.name.text)) {
        const key = n.expression.text + '.' + n.name.text
        references.set(key, [...(references.get(key) || []), ...helperReferences.get(parent.name.text)])
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
}

const wrappers = []
const unresolved = []
for (const [file, source] of sources) {
  if (!file.includes(path.sep + 'api' + path.sep) || file.endsWith(path.sep + 'client.ts')) continue
  const declarations = []
  const collect = n => { if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) declarations.push(n); ts.forEachChild(n, collect) }
  collect(source)
  const getDecl = (name, before = Infinity) => declarations.filter(d => d.name.text === name && d.getStart() < before).at(-1)
  const product = (a, b) => a.flatMap(x => b.map(y => x + y))
  function evaluate(n, depth = 0) {
    if (!n || depth > 10) return ['{}']
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return [n.text]
    if (ts.isTemplateExpression(n)) {
      let result = [n.head.text]
      for (const span of n.templateSpans) result = product(product(result, evaluate(span.expression, depth + 1)), [span.literal.text])
      return result
    }
    if (ts.isConditionalExpression(n)) return [...new Set([...evaluate(n.whenTrue, depth + 1), ...evaluate(n.whenFalse, depth + 1)])]
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return product(evaluate(n.left, depth + 1), evaluate(n.right, depth + 1))
    if (ts.isIdentifier(n)) {
      if (n.text === 'kind') return ['categories', 'active-ingredients']
      const d = getDecl(n.text, n.getStart())
      return d ? evaluate(d.initializer, depth + 1) : ['{}']
    }
    if (ts.isCallExpression(n)) {
      const name = n.expression.getText(source)
      if (/^(toQuery|buildQuery|query)$/.test(name)) return ['']
      const decl = getDecl(name, n.getStart())
      if (decl && ts.isArrowFunction(decl.initializer)) return evaluate(decl.initializer.body, depth + 1)
      return ['{}']
    }
    if (ts.isParenthesizedExpression(n)) return evaluate(n.expression, depth + 1)
    return ['{}']
  }
  function owner(node) {
    let n = node
    let property
    while (n.parent) {
      if (!property && (ts.isPropertyAssignment(n) || ts.isMethodDeclaration(n))) property = n.name?.getText(source)
      if (property && ts.isVariableDeclaration(n)) return n.name.getText(source) + '.' + property
      n = n.parent
    }
    return '(helper)'
  }
  const visit = n => {
    if (ts.isCallExpression(n) && ['api', 'apiBlob', 'fetch', 'post', 'publicAuthPost'].includes(n.expression.getText(source))) {
      const helper = n.expression.getText(source)
      let method = ['post', 'publicAuthPost'].includes(helper) ? 'POST' : 'GET'
      const init = n.arguments[1]
      if (init && ts.isObjectLiteralExpression(init)) {
        const p = init.properties.find(p => p.name?.getText(source) === 'method')
        if (p && ts.isPropertyAssignment(p) && ts.isStringLiteral(p.initializer)) method = p.initializer.text.toUpperCase()
      }
      const routes = evaluate(n.arguments[0]).map(x => x.slice(x.indexOf('/api/'))).filter(x => x.startsWith('/api/')).map(normalize)
      const wrapper = owner(n)
      if (!routes.length && wrapper !== '(helper)') unresolved.push({ file: relative(frontend, file), wrapper, expression: n.arguments[0]?.getText(source) })
      for (const route of new Set(routes)) wrappers.push({ method, route, wrapper, file: relative(frontend, file), line: source.getLineAndCharacterOfPosition(n.getStart()).line + 1, callsites: [...new Set(references.get(wrapper) || [])], reachable: reachable.has(file) })
    }
    ts.forEachChild(n, visit)
  }
  visit(source)
}

for (const e of endpoints) {
  e.wrappers = wrappers.filter(w => w.route === e.normalized && w.method === e.method)
  e.callsites = [...new Set(e.wrappers.flatMap(w => w.callsites))]
  e.scope = ((/Farmer|FARMER/.test(e.roles) && !e.roles.includes('Operate')) || e.route === '/api/auth/register') ? 'farmer' : e.route.endsWith('/webhook') ? 'provider' : e.route.endsWith('/simulate-paid') ? 'development' : 'management'
  e.status = e.callsites.length ? 'ui-used' : e.wrappers.length ? 'wrapper-only' : e.scope === 'management' ? 'not-wrapped' : e.scope
}
const unmatched = wrappers.filter(w => !endpoints.some(e => e.normalized === w.route && e.method === w.method))
const result = { generatedAt: '2026-10-11', method: 'Static controller attributes + TypeScript AST wrapper expressions + references in main.tsx import graph. No network/runtime verification.', counts: { endpoints: endpoints.length, controllers: new Set(endpoints.map(e => e.controller)).size, management: endpoints.filter(e => e.scope === 'management').length, uiUsed: endpoints.filter(e => e.status === 'ui-used').length, wrapperOnly: endpoints.filter(e => e.status === 'wrapper-only').length, managementNotWrapped: endpoints.filter(e => e.status === 'not-wrapped').length, farmer: endpoints.filter(e => e.scope === 'farmer').length, provider: endpoints.filter(e => e.scope === 'provider').length, development: endpoints.filter(e => e.scope === 'development').length }, endpoints, unmatched, unresolved }
fs.mkdirSync(path.join(frontend, 'docs'), { recursive: true })
fs.writeFileSync(path.join(frontend, 'docs/API_INTEGRATION_MATRIX.json'), JSON.stringify(result, null, 2) + '\n')
if (endpoints.some(e => !e.route.startsWith('/api/'))) throw new Error('An HTTP action has an unresolved controller route')
if (new Set(endpoints.map(e => `${e.method} ${e.normalized}`)).size !== endpoints.length) throw new Error('Duplicate method/path pair in controller inventory')
const statuses = { 'ui-used': 'Có UI gọi', 'wrapper-only': 'Chỉ có wrapper', 'not-wrapped': 'Chưa có wrapper', farmer: 'Farmer', provider: 'Provider callback', development: 'Chỉ Development' }
const missing = endpoints.filter(e => e.status === 'not-wrapped')
const unused = endpoints.filter(e => e.status === 'wrapper-only')
const featureGaps = [
  ['payOS tạo link/đồng bộ/hủy thanh toán', e => e.method === 'POST' && (/^\/api\/payments\/payos$/.test(e.route) || /\/api\/payments\/\{[^}]+\}\/(sync|cancel)$/.test(e.route))],
  ['quản lý thương hiệu', e => e.method !== 'GET' && e.controller === 'BrandsController'],
  ['chỉnh quy cách đóng gói của sản phẩm đã tồn tại và liên kết hoạt chất', e => e.controller === 'ProductsController' && /\/packagings|\/ingredients/.test(e.route)],
  ['SKU/mức tồn tối thiểu riêng của cửa hàng và gỡ sản phẩm khỏi cửa hàng', e => e.controller === 'StoreProductsController' && ['PUT', 'DELETE'].includes(e.method)],
  ['cấu hình bệnh và phác đồ điều trị', e => ['DiseasesController', 'DiseaseTreatmentsController'].includes(e.controller) && e.method !== 'GET'],
  ['thêm dòng vào phiếu trả sau khi tạo', e => e.controller === 'SalesReturnsController' && e.method === 'POST' && e.route.endsWith('/items')],
  ['quản lý nhân viên đầy đủ', e => e.controller === 'StaffController'],
].filter(([, predicate]) => endpoints.some(e => e.scope === 'management' && e.status !== 'ui-used' && predicate(e))).map(([label]) => label)
const reportEndpoints = endpoints.filter(e => e.route.startsWith('/api/reports/'))
const mockFiles = [...reachable].filter(p => /[\\/]mock[^\\/]*\.(ts|tsx)$/.test(p)).map(p => relative(frontend, p)).sort()
const mainRows = endpoints.map(e => `| ${e.method} | \`${e.route}\` | ${statuses[e.status]} | ${e.wrappers.map(w => `\`${w.wrapper}\``).join(', ') || '—'} | ${e.callsites.map(c => `\`${c}\``).join('<br>') || '—'} |`).join('\n')
const shortRows = rows => rows.map(e => `| ${e.method} | \`${e.route}\` | \`${e.file}:${e.line}\` |`).join('\n')
const summary = `# Rà soát kết nối Backend → Management-Webs\n\nNgày: **11/10/2026**. Nguồn HTTP: code hiện tại trong \`D:/Test/Backend-Agrisage/src/AgriSage.Api\`; nguồn frontend: \`src/api\` và callsite trong đồ thị import của \`src/main.tsx\`.\n\n**Chưa tích hợp tất cả API backend vào trang quản lý.** Backend có ${result.counts.endpoints} HTTP action trong ${result.counts.controllers} controller; ${result.counts.management} action dùng cho quản lý/nhân viên hoặc xác thực dùng chung. ${result.counts.farmer} action dành cho Farmer (kể cả đăng ký), 1 webhook của payOS và 1 action mô phỏng thanh toán trong Development được tách khỏi số API quản lý cần xét.\n\n| Phạm vi quản lý/xác thực chung | Số HTTP action |\n| --- | ---: |\n| Có wrapper và tham chiếu từ UI đang được import | ${result.counts.uiUsed} |\n| Có wrapper nhưng chưa thấy callsite UI | ${result.counts.wrapperOnly} |\n| Chưa có wrapper | ${result.counts.managementNotWrapped} |\n| Tổng | ${result.counts.management} |\n\nCó **${unmatched.length}** wrapper lệch HTTP method/route so với controller. Cả ${reportEndpoints.length} route \`/api/reports/*\` đều có tham chiếu từ UI. Đây là kiểm tra tĩnh theo method/route và tham chiếu code; chưa chứng minh request thành công trên server thật, đúng quyền của từng tài khoản, hoặc mọi trường DTO đều tương thích. Một wrapper được UI truyền vào callback cũng được tính là có callsite.\n\n## Các phần còn thiếu cần phân biệt\n\n- **Tính năng quản lý chưa có UI:** payOS tạo link/đồng bộ/hủy thanh toán; quản lý thương hiệu; chỉnh quy cách đóng gói của sản phẩm đã tồn tại và liên kết hoạt chất; SKU/mức tồn tối thiểu riêng của cửa hàng; cấu hình bệnh và phác đồ điều trị; thêm dòng vào phiếu trả sau khi tạo. Xem danh sách route còn thiếu bên dưới để xác định phần vẫn chưa tích hợp ở checkout hiện tại.\n- **Bảo mật tài khoản:** API refresh và xác minh email/điện thoại chỉ có backend khi chưa xuất hiện trong bảng callsite. Không đồng nghĩa với đăng nhập bị lỗi; hiện frontend có thể sử dụng access token và yêu cầu đăng nhập lại khi hết hạn.\n- **API đọc thay thế:** một số route lấy riêng từng bản ghi chưa được gọi vì UI đã nhận dữ liệu từ danh sách hoặc DTO chi tiết cha. Ví dụ nợ theo khách có thể dùng \`GET /api/debt-entries?FarmerProfileId=...\`; lượt giao đã nằm trong chi tiết chuyến; reservation có thể đọc qua gợi ý FEFO. Không tạo request dư chỉ để tăng tỷ lệ bao phủ.\n- **Dành cho ứng dụng Farmer:** \`/api/me/cart\`, profile/addresses, orders, deliveries, credit/debt, payments và diagnosis/returns của Farmer không được coi là thiếu của Management-Webs. \`/api/me/notifications\` và \`/api/me/permissions\` vẫn thuộc phạm vi dùng chung và đã tính trong quản lý.\n- **Provider/Development:** payOS tự gọi webhook. \`simulate-paid\` chỉ dành cho môi trường Development, không cần nút tác vụ trên trang quản lý thật.\n\n## Dữ liệu giao diện chưa đồng bộ server\n\nCác file mock vẫn nằm trong đồ thị import của các màn hình hiện tại:\n\n${mockFiles.length ? mockFiles.map(f => `- \`${f}\``).join('\n') : '- Không còn file mock trong đồ thị import đang sử dụng.'}\n\nTrang Accounts, Articles và ProductReviews dùng dữ liệu mẫu nếu các nguồn tương ứng ở trên vẫn còn được import. Backend hiện không có controller quản trị tài khoản toàn hệ thống, bài viết hay đánh giá sản phẩm để thay thế trực tiếp các nguồn đó. Đây là thiếu chức năng/contract backend + frontend, khác với việc bỏ quên một API đã tồn tại. Các biểu đồ hoặc bảng của dashboard phải kiểm tra nguồn riêng, không suy từ việc đã có một nhóm thẻ báo cáo thật.\n\n## Tìm kiếm, lọc và phân trang\n\n\`NotificationListRequest\` chỉ hỗ trợ Status + pagination. \`StockMovementListRequest\` hỗ trợ Type, FromDate, ToDate, GoodsReceiptId + pagination. \`AiModelListRequest\` không có Search. Các trang này cần tìm kiếm client có phạm vi rõ ràng hoặc thay đổi contract được duyệt; gửi tham số Search tự đặt không làm server tìm kiếm. Dữ liệu tổng trên server và số đếm của trang đang mở cần có nhãn riêng.\n\n\`GET /api/catalog/categories\` trả **mảng cây** CategoryTreeNode có Children, không trả Paged. Các ô chọn cần duyệt cả Children nếu muốn chọn danh mục con. \`InventoryLotResponse\` đã chứa Sku/ProductName; tải lại toàn bộ catalog chỉ để hiển thị tên lô sẽ tạo thêm request và có thể thiếu sản phẩm không còn bán.\n\n## Route quản lý chưa có wrapper\n\n| Method | Route | Nguồn backend |\n| --- | --- | --- |\n${shortRows(missing)}\n\n## Wrapper chưa thấy callsite UI\n\n| Method | Route | Nguồn backend |\n| --- | --- | --- |\n${shortRows(unused)}\n\n## Ma trận toàn bộ HTTP action\n\n| Method | Route backend | Tích hợp | Wrapper | Callsite UI |\n| --- | --- | --- | --- | --- |\n${mainRows}\n\n## Tái tạo kết quả\n\nChạy \`node scripts/audit-api-integration.mjs\` từ Management-Webs; đường dẫn backend mặc định là repo Backend-Agrisage cùng cấp. Có thể truyền đường dẫn repo backend làm argument. Script chỉ đọc source code, không đọc cấu hình/secrets và không gọi mạng. Kết quả chi tiết gồm quyền controller/action, file/line, wrapper và callsite nằm trong [API_INTEGRATION_MATRIX.json](API_INTEGRATION_MATRIX.json). Inventory kiểm tra không có route rỗng hoặc trùng method/path. Không thay đổi backend, DB hoặc migration.\n`
const reportText = summary.replace('payOS tạo link/đồng bộ/hủy thanh toán; quản lý thương hiệu; chỉnh quy cách đóng gói của sản phẩm đã tồn tại và liên kết hoạt chất; SKU/mức tồn tối thiểu riêng của cửa hàng; cấu hình bệnh và phác đồ điều trị; thêm dòng vào phiếu trả sau khi tạo.', featureGaps.join('; ') + '.')
fs.writeFileSync(path.join(frontend, 'docs/API_INTEGRATION_AUDIT.md'), reportText)
console.log(JSON.stringify({ counts: result.counts, notWrapped: endpoints.filter(e => e.status === 'not-wrapped').map(e => e.method + ' ' + e.route), wrapperOnly: endpoints.filter(e => e.status === 'wrapper-only').map(e => e.method + ' ' + e.route + ' -> ' + e.wrappers.map(w => w.wrapper).join(',')), unmatched, unresolved }, null, 2))
