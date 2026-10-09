import ModalLayout from '@/components/ui/ModalLayout'
import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type {
  CompleteAttemptRequest,
  CreateIncidentRequest,
  DeliveryAttempt,
  DeliveryItem,
  FailureReason,
  IncidentType,
} from '@/api/deliveriesApi'
import { FAILURE_REASON_LABEL } from '@/utils/deliveryLabels'

const FAILURE_CODES = Object.keys(FAILURE_REASON_LABEL) as FailureReason[]

const inputClassName =
  'w-full h-10 px-3 text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface'

// ─── Photo picker ─────────────────────────────────────────────────────────────

function PhotoPicker({ file, onChange, label, required }: { file: File | null; onChange: (f: File | null) => void; label: string; required?: boolean }) {
  const ref = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  return (
    <div>
      <span className="font-label-md text-label-md text-on-surface-variant block mb-1">
        {label} {required && <span className="text-error">*</span>}
      </span>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      {preview ? (
        <div className="relative">
          <img src={preview} alt="Ảnh đã chọn" className="w-full max-h-48 object-cover rounded-lg border border-outline-variant" />
          <button
            type="button"
            aria-label="Bỏ ảnh"
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center"
            onClick={() => { onChange(null); if (ref.current) ref.current.value = '' }}
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="w-full h-24 border-2 border-dashed border-outline-variant rounded-lg flex flex-col items-center justify-center gap-1 text-on-surface-variant hover:bg-surface-container-low transition-colors"
        >
          <span className="material-symbols-outlined text-[28px]">add_a_photo</span>
          <span className="font-body-sm text-body-sm">Chụp hoặc chọn ảnh</span>
        </button>
      )}
    </div>
  )
}

// ─── Lines carried on the running attempt ─────────────────────────────────────

export interface CarriedLine {
  item: DeliveryItem
  /** Base units per pack (thùng/bao), so the driver can count packs. */
  conversion: number
  allocations: { allocationId: string; attemptedBaseQuantity: number }[]
  attemptedBaseQuantity: number
}

/** Groups the attempt's lot rows back under their delivery line. */
export function carriedLines(items: DeliveryItem[], attempt: DeliveryAttempt): CarriedLine[] {
  return items
    .map((item) => {
      const ids = new Set(item.allocations.map((a) => a.id))
      const allocations = attempt.items
        .filter((ai) => ids.has(ai.allocationId) && ai.attemptedBaseQuantity > 0)
        .map((ai) => ({ allocationId: ai.allocationId, attemptedBaseQuantity: ai.attemptedBaseQuantity }))
      const conversion = item.plannedQuantity > 0 ? Math.max(1, Math.round(item.plannedBaseQuantity / item.plannedQuantity)) : 1
      return { item, conversion, allocations, attemptedBaseQuantity: allocations.reduce((s, a) => s + a.attemptedBaseQuantity, 0) }
    })
    .filter((l) => l.attemptedBaseQuantity > 0)
}

/** Spreads a delivered base quantity over the line's lots in their listed order (§D2). */
function spread(line: CarriedLine, baseQuantity: number) {
  let left = baseQuantity
  return line.allocations.map((a) => {
    const qty = Math.min(a.attemptedBaseQuantity, left)
    left -= qty
    return { allocationId: a.allocationId, deliveredBaseQuantity: qty }
  })
}

// ─── Complete attempt ─────────────────────────────────────────────────────────

export type AttemptOutcome = 'full' | 'partial' | 'failed'

const OUTCOME_TITLE: Record<AttemptOutcome, string> = {
  full: 'Giao thành công toàn bộ',
  partial: 'Giao một phần',
  failed: 'Không giao được',
}

interface CompleteAttemptModalProps {
  outcome: AttemptOutcome | null
  lines: CarriedLine[]
  loading: boolean
  onClose: () => void
  /** The page uploads the photo first, then sends the request with its URL. */
  onSubmit: (request: Omit<CompleteAttemptRequest, 'proofImageUrl'>, photo: File | null) => void
}

export function CompleteAttemptModal({ outcome, lines, loading, onClose, onSubmit }: CompleteAttemptModalProps) {
  const [receiverName, setReceiverName] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [reason, setReason] = useState<FailureReason | ''>('')
  const [note, setNote] = useState('')
  const [packs, setPacks] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!outcome) return
    setReceiverName('')
    setPhoto(null)
    setReason('')
    setNote('')
    setPacks(Object.fromEntries(lines.map((l) => [l.item.id, outcome === 'partial' ? 0 : Math.floor(l.attemptedBaseQuantity / l.conversion)])))
  }, [outcome, lines])

  if (!outcome) return null

  const isFailed = outcome === 'failed'
  const items = isFailed
    ? []
    : lines.flatMap((l) =>
      outcome === 'full'
        ? l.allocations.map((a) => ({ allocationId: a.allocationId, deliveredBaseQuantity: a.attemptedBaseQuantity }))
        : spread(l, (packs[l.item.id] ?? 0) * l.conversion),
    ).filter((i) => i.deliveredBaseQuantity > 0)

  const deliveredAnything = items.length > 0
  const canSubmit = isFailed
    ? !!reason
    : !!receiverName.trim() && !!photo && deliveredAnything && (outcome === 'full' || !!reason)

  const submit = () =>
    onSubmit(
      {
        items,
        receiverName: isFailed ? null : receiverName.trim(),
        failureReasonCode: reason || null,
        note: note.trim() || null,
      },
      isFailed ? null : photo,
    )

  return (
    <Modal open onClose={onClose} title={OUTCOME_TITLE[outcome]}>
      <ModalLayout footer={<Button
        fullWidth
        variant={isFailed ? 'danger' : 'primary'}
        icon={isFailed ? 'event_repeat' : 'check_circle'}
        onClick={submit}
        disabled={!canSubmit || loading}
      >
        {loading ? 'Đang xử lý...' : isFailed ? 'Ghi nhận không giao được' : 'Xác nhận đã giao'}
      </Button>}>

        {outcome === 'partial' && (
          <div className="space-y-2">
            <p className="font-body-sm text-body-sm text-on-surface-variant">Nhập số <strong>thùng/bao thực tế đã giao</strong> cho từng mặt hàng.</p>
            {lines.map((l) => {
              const maxPacks = Math.floor(l.attemptedBaseQuantity / l.conversion)
              return (
                <div key={l.item.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-body-md text-body-md text-on-surface font-semibold truncate">{l.item.productName}</div>
                    <div className="font-body-sm text-body-sm text-on-surface-variant">Mang theo: {maxPacks} {l.item.packagingName}</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={maxPacks}
                    aria-label={`Số ${l.item.packagingName} đã giao của ${l.item.productName}`}
                    className="w-20 h-10 px-2 text-sm text-center border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary"
                    value={packs[l.item.id] ?? 0}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(maxPacks, Math.floor(Number(e.target.value) || 0)))
                      setPacks((prev) => ({ ...prev, [l.item.id]: v }))
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}

        {outcome === 'full' && (
          <ul className="text-sm text-on-surface-variant space-y-1">
            {lines.map((l) => (
              <li key={l.item.id} className="flex justify-between gap-2">
                <span className="truncate">{l.item.productName}</span>
                <span className="tabular-nums shrink-0">{Math.floor(l.attemptedBaseQuantity / l.conversion)} {l.item.packagingName}</span>
              </li>
            ))}
          </ul>
        )}

        {!isFailed && (
          <>
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Tên người nhận <span className="text-error">*</span></span>
              <input className={inputClassName} placeholder="Nhập tên người nhận hàng..." value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
            </label>
            <PhotoPicker file={photo} onChange={setPhoto} label="Ảnh bằng chứng giao hàng" required />
          </>
        )}

        {outcome !== 'full' && (
          <label className="block">
            <span className="font-label-md text-label-md text-on-surface-variant block mb-1">
              {isFailed ? 'Lý do không giao được' : 'Lý do phần chưa giao'} <span className="text-error">*</span>
            </span>
            <select className={inputClassName} value={reason} onChange={(e) => setReason(e.target.value as FailureReason)}>
              <option value="">-- Chọn lý do --</option>
              {FAILURE_CODES.map((c) => (
                <option key={c} value={c}>{FAILURE_REASON_LABEL[c]}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Ghi chú</span>
          <textarea
            className="w-full min-h-16 p-2 text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface"
            placeholder={isFailed ? 'Mô tả thêm tình huống...' : 'VD: Giao cho người thân...'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        {isFailed && (
          <p className="text-xs text-on-surface-variant bg-surface-container-low rounded p-2">
            Hàng chưa bị trừ kho. Phiếu chuyển sang "Chờ giao lại" và cửa hàng sẽ xuất phát lại khi hẹn được khách.
          </p>
        )}



      </ModalLayout>
    </Modal>
  )
}

// ─── Report incident (D3) ─────────────────────────────────────────────────────

interface ReportIncidentModalProps {
  open: boolean
  lines: CarriedLine[]
  loading: boolean
  onClose: () => void
  onSubmit: (request: Omit<CreateIncidentRequest, 'evidenceImageUrl' | 'deliveryAttemptId'>, photo: File | null) => void
}

export function ReportIncidentModal({ open, lines, loading, onClose, onSubmit }: ReportIncidentModalProps) {
  const [incidentType, setIncidentType] = useState<IncidentType | ''>('')
  const [description, setDescription] = useState('')
  const [allocationId, setAllocationId] = useState('')
  const [affected, setAffected] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  useEffect(() => {
    if (open) {
      setIncidentType('')
      setDescription('')
      setAllocationId('')
      setAffected('')
      setPhoto(null)
    }
  }, [open])

  if (!open) return null

  const lots = lines.flatMap((l) =>
    l.allocations.map((a) => {
      const lot = l.item.allocations.find((x) => x.id === a.allocationId)
      return { id: a.allocationId, max: a.attemptedBaseQuantity, label: `${l.item.productName} · lô ${lot?.lotNumber ?? '—'}` }
    }),
  )
  const selectedLot = lots.find((l) => l.id === allocationId)
  const affectedQty = affected ? Math.floor(Number(affected)) : undefined
  const affectedValid = affectedQty === undefined || (affectedQty > 0 && (!selectedLot || affectedQty <= selectedLot.max))

  return (
    <Modal open onClose={onClose} title="Báo cáo sự cố">
      <ModalLayout footer={<Button
        fullWidth
        icon="report"
        onClick={() =>
          onSubmit(
            {
              incidentType: incidentType as IncidentType,
              description: description.trim(),
              allocationId: allocationId || undefined,
              affectedBaseQuantity: allocationId ? affectedQty : undefined,
            },
            photo,
          )
        }
        disabled={!incidentType || !description.trim() || !affectedValid || loading}
      >
        {loading ? 'Đang gửi...' : 'Gửi báo cáo sự cố'}
      </Button>}>

        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Báo ngay khi có sự cố trên đường. Khách từ chối nhận trước khi giao cũng báo ở đây (Khách từ chối nhận).
        </p>
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Loại sự cố <span className="text-error">*</span></span>
          <select className={inputClassName} value={incidentType} onChange={(e) => setIncidentType(e.target.value as IncidentType)}>
            <option value="">-- Chọn loại sự cố --</option>
            {FAILURE_CODES.map((c) => (
              <option key={c} value={c}>{FAILURE_REASON_LABEL[c]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Mô tả chi tiết <span className="text-error">*</span></span>
          <textarea
            className="w-full min-h-20 p-2 text-sm bg-surface-container-low border border-outline-variant rounded focus:border-primary focus:ring-1 focus:ring-primary text-on-surface"
            placeholder="VD: Rách 1 bao trên đường"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {lots.length > 0 && (
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Lô bị ảnh hưởng</span>
              <select className={inputClassName} value={allocationId} onChange={(e) => setAllocationId(e.target.value)}>
                <option value="">-- Không chọn --</option>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-label-md text-label-md text-on-surface-variant block mb-1">Số lượng gốc</span>
              <input
                type="number"
                min={1}
                max={selectedLot?.max}
                className={inputClassName}
                value={affected}
                onChange={(e) => setAffected(e.target.value)}
                disabled={!allocationId}
              />
            </label>
          </div>
        )}
        {!affectedValid && <p className="text-xs text-error">Số lượng phải lớn hơn 0 và không vượt quá {selectedLot?.max} của lô.</p>}
        <PhotoPicker file={photo} onChange={setPhoto} label="Ảnh hiện trường (nếu có)" />


      </ModalLayout>
    </Modal>
  )
}
