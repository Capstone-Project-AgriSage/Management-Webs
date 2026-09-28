import { usePageHeader } from '@/context/PageHeaderContext'

interface PlaceholderPageProps {
  title: string
  subtitle: string
  icon: string
  tasks: string[]
}

export default function PlaceholderPage({ title, subtitle, icon, tasks }: PlaceholderPageProps) {
  usePageHeader({ title, subtitle })

  return (
    <div className="bg-white rounded-lg border border-outline-variant/60 shadow-2xs p-8">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-lg bg-primary-fixed/50 flex items-center justify-center text-primary shrink-0">
          <span className="material-symbols-outlined text-[24px]">{icon}</span>
        </div>
        <div className="min-w-0">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{subtitle}</p>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-outline-variant/60">
        <p className="font-label-sm text-label-sm uppercase text-on-surface-variant mb-3">
          Chức năng cần xây dựng
        </p>
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li key={task} className="flex items-start gap-2 font-body-md text-body-md text-on-surface">
              <span className="material-symbols-outlined text-[18px] text-outline mt-0.5 shrink-0">
                radio_button_unchecked
              </span>
              {task}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
