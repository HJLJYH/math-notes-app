import React from 'react'

interface CategoriesProps {
  categories: string[]
  current: string
  onChange: (category: string) => void
}

const Categories: React.FC<CategoriesProps> = ({ categories, current, onChange }) => {
  return (
    <div style={{ 
      padding: '12px', 
      background: 'white', 
      borderRadius: '8px',
      marginBottom: '16px',
      overflowX: 'auto',
      whiteSpace: 'nowrap'
    }}>
      <div 
        className={`category-tag ${current === '全部' ? 'active' : ''}`}
        onClick={() => onChange('全部')}
      >
        全部
      </div>
      {categories.map(cat => (
        <div 
          key={cat}
          className={`category-tag ${current === cat ? 'active' : ''}`}
          onClick={() => onChange(cat)}
        >
          {cat}
        </div>
      ))}
    </div>
  )
}

export default Categories
