import { Tooltip } from 'antd'

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

interface Props {
  title: string
  subtitle: string
  cards: HubCard[]
}

const HubPage = ({ title, subtitle, cards }: Props) => {
  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a2332' }}>{title}</h2>
        <p style={{ color: '#8c9db5', margin: '4px 0 0', fontSize: 13 }}>{subtitle}</p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {cards.map((card, i) => {
          const isDisabled = card.disabled || card.comingSoon
          const cardEl = (
            <div
              key={i}
              onClick={isDisabled ? undefined : card.onClick}
              style={{
                width: 200, minHeight: 140,
                background: isDisabled ? '#fafafa' : '#fff',
                borderRadius: 12, padding: 24,
                border: `1px solid ${isDisabled ? '#f0f0f0' : '#e8ecf0'}`,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.55 : 1,
                transition: 'all 0.2s',
                display: 'flex', flexDirection: 'column', gap: 8,
                boxShadow: isDisabled ? 'none' : '0 1px 3px rgba(0,0,0,0.06)',
                position: 'relative'
              }}
              onMouseEnter={e => {
                if (!isDisabled) {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)'
                  el.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = isDisabled ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
                el.style.transform = 'translateY(0)'
              }}
            >
              {/* Badge de pendientes */}
              {card.badge !== undefined && card.badge > 0 && (
                <div style={{
                  position: 'absolute', top: 10, right: 10,
                  background: '#f5222d', color: '#fff', borderRadius: 10,
                  padding: '1px 7px', fontSize: 11, fontWeight: 700
                }}>
                  {card.badge}
                </div>
              )}

              <div style={{ fontSize: 32 }}>{card.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#1a2332' }}>{card.label}</div>

              {card.count !== undefined && (
                <div style={{ fontSize: 12, color: '#8c9db5' }}>
                  {card.count.toLocaleString()} docs
                </div>
              )}

              {card.description && (
                <div style={{ fontSize: 12, color: '#8c9db5' }}>{card.description}</div>
              )}

              {card.comingSoon && (
                <div style={{
                  fontSize: 10, color: '#fff', background: '#faad14',
                  borderRadius: 4, padding: '2px 6px',
                  alignSelf: 'flex-start', fontWeight: 600
                }}>
                  Próximamente
                </div>
              )}
            </div>
          )

          return card.disabled && card.disabledTooltip
            ? <Tooltip key={i} title={card.disabledTooltip}>{cardEl}</Tooltip>
            : cardEl
        })}
      </div>
    </div>
  )
}

export default HubPage