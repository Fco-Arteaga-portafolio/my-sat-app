import { Tooltip } from 'antd'
import './HubPage.css'

interface HubCard {
  icon: string
  label: string
  description?: string
  count?: number
  badge?: number
  disabled?: boolean
  disabledTooltip?: string
  comingSoon?: boolean
  onClick?: () => void
}

interface HubSection {
  title: string
  cards: HubCard[]
}

interface Props {
  title: string
  subtitle: string
  cards?: HubCard[]
  sections?: HubSection[]
}

const HubCardItem = ({ card }: { card: HubCard }) => {
  const isDisabled = card.disabled || card.comingSoon

  const cardEl = (
    <div
      className={`hub-card ${isDisabled ? 'hub-card--disabled' : 'hub-card--active'}`}
      onClick={isDisabled ? undefined : card.onClick}
    >
      {card.badge !== undefined && card.badge > 0 && (
        <div className="hub-card-badge">{card.badge}</div>
      )}

      <div className="hub-card-icon">{card.icon}</div>
      <div className="hub-card-label">{card.label}</div>

      {card.count !== undefined && (
        <div className="hub-card-count">{card.count?.toLocaleString()} docs</div>
      )}

      {card.description && <div className="hub-card-description">{card.description}</div>}

      {card.comingSoon && <div className="hub-card-coming-soon">Próximamente</div>}
    </div>
  )

  return card.disabled && card.disabledTooltip ? (
    <Tooltip title={card.disabledTooltip}>{cardEl}</Tooltip>
  ) : (
    cardEl
  )
}

const HubPage = ({ title, subtitle, cards, sections }: Props) => {
  const resolvedSections: HubSection[] = sections ? sections : [{ title: '', cards: cards ?? [] }]

  return (
    <div className="hub-container">
      <div className="hub-header">
        <h2 className="hub-title">{title}</h2>
        <p className="hub-subtitle">{subtitle}</p>
      </div>

      <div className="hub-sections">
        {resolvedSections.map((section, si) => (
          <div key={si} className="hub-section">
            {section.title && <div className="hub-section-title">{section.title}</div>}
            <div className="hub-cards">
              {section.cards.map((card, ci) => (
                <HubCardItem key={ci} card={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default HubPage
