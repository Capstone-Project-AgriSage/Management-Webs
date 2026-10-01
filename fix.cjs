const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  // Find the last occurrence of </>
  const lastIndex = code.lastIndexOf('</>');
  if (lastIndex !== -1) {
    code = code.substring(0, lastIndex) + '</div>' + code.substring(lastIndex + 3);
    fs.writeFileSync(file, code, 'utf8');
    console.log('Fixed', file);
  } else {
    console.log('Not found in', file);
  }
}

fix('src/features/agent/orders/OrdersPage.tsx');
fix('src/features/sales/orders/OrdersPage.tsx');
