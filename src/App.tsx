import { useState } from 'react'
import quotes from './quotes.json'

type Quote = {
  id: number
  text: string
  author: string
  profile: string
}

type CatImage = {
  id: string
  url: string
}

const CAT_API_URL = '/api/cat'

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]

async function fetchCatImage(): Promise<CatImage> {
  const response = await fetch(CAT_API_URL)
  if (!response.ok) throw new Error(`TheCatAPI responded ${response.status}`)
  const [image] = (await response.json()) as CatImage[]
  if (!image) throw new Error('TheCatAPI returned no image')

  // 画像を読み込み終えてから切り替え、表示のちらつきを防ぎます。
  const preloadImage = new Image()
  preloadImage.src = image.url
  await preloadImage.decode().catch(() => {
    // decode()非対応・失敗時も、imgタグ側で読み込みを継続します。
  })
  return image
}

function App() {
  const [cat, setCat] = useState<CatImage | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const drawToday = async () => {
    setIsLoading(true)
    setError('')
    try {
      const image = await fetchCatImage()
      const candidates = quote ? quotes.filter((candidate) => candidate.id !== quote.id) : quotes
      setCat(image)
      setQuote(pick(candidates))
    } catch {
      setError('猫さまがお昼寝中のようです。少し待ってからもう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main>
      <div className="background-word" aria-hidden="true">WISDOM</div>
      <header>
        <span className="eyebrow">TODAY'S CAT &amp; WORDS</span>
        <h1>猫と<span>名言</span></h1>
        <p>猫に癒されながら、偉人の言葉にふれるひととき</p>
      </header>

      <section className={`fortune-card ${cat ? 'has-result' : ''} ${isLoading ? 'shuffling' : ''}`} aria-live="polite">
        {!cat || !quote ? (
          <div className="welcome">
            <div className="moon">☾<span>✦</span></div>
            <div className="cat-silhouette">🐈</div>
            <h2>本日の1枚を届けます</h2>
            <p>下のボタンを押すと、猫の写真と名言がひとつ届きます</p>
          </div>
        ) : (
          <div className="result">
            <div className="cat-panel">
              <img className="cat-image" src={cat.url} alt="今日の猫の写真" />
            </div>
            <div className="quote-panel">
              <span className="chosen">本日のことば</span>
              <blockquote>
                <p>{quote.text}</p>
                <footer>
                  <cite>{quote.author}</cite>
                  <span>{quote.profile}</span>
                </footer>
              </blockquote>
            </div>
          </div>
        )}
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      <button className="fortune-button" onClick={drawToday} disabled={isLoading}>
        <span>🐾</span>{isLoading ? '猫さまを呼んでいます…' : cat ? 'もう1枚' : '本日の1枚'}<span>›</span>
      </button>
      <p className="note">写真は TheCatAPI から届きます。何度でも引き直せます</p>
      <footer className="page-footer"><span>✦</span> MAY THE CATS BE WITH YOU <span>✦</span></footer>
    </main>
  )
}

export default App
