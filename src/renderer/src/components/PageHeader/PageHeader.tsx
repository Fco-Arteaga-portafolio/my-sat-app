import { useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { Button, Divider, Typography } from 'antd'
import './PageHeader.css'

const { Title, Text } = Typography

interface PageHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
}

const PageHeader = ({ title, subtitle, backTo }: PageHeaderProps) => {
  const navigate = useNavigate()

  return (
    <>
      <div className="page-header-row">
        {backTo && (
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            onClick={() => navigate(backTo)}
            className="page-header-back"
          />
        )}
        <div className="page-header-content">
          <Title level={4} className="page-header-title">
            {title}
          </Title>
          {subtitle && <Text className="page-header-subtitle">{subtitle}</Text>}
        </div>
      </div>
      <Divider className="page-header-divider" />
    </>
  )
}

export default PageHeader
