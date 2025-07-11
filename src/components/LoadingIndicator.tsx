import { useAppState } from '../store'
import { translations } from '../utils'

export const LoadingIndicator = () => {
  const { language } = useAppState()
  const t = translations[language]
  return (
    <div className="px-6 py-6 bg-gradient-to-r from-red-600/5 to-red-600/5">
      <div className="flex items-start w-full max-w-3xl gap-4 mx-auto">
        <div className="flex items-center justify-center flex-shrink-0 w-8 h-8 ml-4 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-red-600 to-red-600">
          AI
        </div>
        <div className="relative flex-shrink-0 w-8 h-8">
          <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-600 to-red-600 animate-[spin_2s_linear_infinite]"></div>
          <div className="absolute inset-[2px] rounded-lg bg-black flex items-center justify-center text-white">
            <div className="relative flex items-center justify-center w-full h-full rounded-lg bg-gradient-to-r from-red-600 to-red-600">
              <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-600 to-red-600 animate-pulse"></div>
              <span className="relative z-10 text-sm font-medium text-white"></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-lg font-medium text-gray-400">{t.thinking}</div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-red-600 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-red-600 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-red-600 animate-[bounce_0.8s_infinite]" style={{ animationDelay: '400ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}