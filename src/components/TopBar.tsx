import { Globe, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAppState } from '../store'

export function TopBar() {
  const { language, setLanguage } = useAppState()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLanguageSelect = (lang: 'en' | 'ar') => {
    setLanguage(lang)
    setIsOpen(false)
  }

  return (
    <div
      className={`fixed top-0 z-20 flex items-center gap-4 p-4 ${
        language === 'ar' ? 'left-0' : 'right-0'
      }`}
    >
      {/* Collapsible Language Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 hover:bg-gray-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-600"
        >
          <Globe className="w-4 h-4" />
          <span className="text-sm font-medium">{language.toUpperCase()}</span>
          <ChevronDown 
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`} 
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute top-full mt-1 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden min-w-[120px] z-30">
            <button
              onClick={() => handleLanguageSelect('en')}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-700 transition-colors duration-150 flex items-center gap-2 ${
                language === 'en' ? 'bg-red-600 text-white' : 'text-gray-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              English
            </button>
            <button
              onClick={() => handleLanguageSelect('ar')}
              className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-700 transition-colors duration-150 flex items-center gap-2 ${
                language === 'ar' ? 'bg-red-600 text-white' : 'text-gray-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              العربية
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
