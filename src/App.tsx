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

function SleepingCat() {
  return (
    <svg className="illustration" viewBox="0 0 160 140" aria-hidden="true">
      <path className="ground" d="M30 128H130" />
      <path d="M56 50L58 18L74 30Q80 28 86 30L102 18L104 50A24 24 0 0 1 56 50Z" />
      <path d="M62 72Q48 96 52 124H108Q112 96 98 72" />
      <path d="M108 118Q138 116 134 92Q132 80 122 84" />
      <path d="M68 52q4 3 8 0M84 52q4 3 8 0M78 60l2 2 2-2M72 124v-10M88 124v-10" />
      <path className="zzz" d="M116 22h8l-8 9h8M130 8h6l-6 7h6" />
    </svg>
  )
}

function PawIcon() {
  return (
    <svg className="paw" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="16" rx="5" ry="4.2" />
      <circle cx="5.5" cy="10" r="2.2" />
      <circle cx="9.5" cy="6" r="2.2" />
      <circle cx="14.5" cy="6" r="2.2" />
      <circle cx="18.5" cy="10" r="2.2" />
    </svg>
  )
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
      setError('猫がお昼寝中のようです。少し待ってからもう一度お試しください。')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="page">
      <header className="masthead">
        <p className="label">Cat &amp; Words</p>
        <h1>猫と名言</h1>
        <p className="lead">猫に癒されながら、偉人の言葉にふれるひととき</p>
      </header>

      <main>
        <article className="card" aria-live="polite" aria-busy={isLoading}>
          <figure className={`photo ${isLoading ? 'is-loading' : ''}`}>
            {cat ? (
              <img key={cat.id} src={cat.url} alt="TheCatAPI から届いた猫の写真" />
            ) : (
              <div className="placeholder"><SleepingCat /></div>
            )}
          </figure>

          <div className="words">
            <p className="label">本日のことば</p>
            {quote ? (
              <blockquote key={quote.id}>
                <p>{quote.text}</p>
                <footer>
                  <cite>{quote.author}</cite>
                  <span>{quote.profile}</span>
                </footer>
              </blockquote>
            ) : (
              <div className="intro">
                <h2>今日の1枚を届けます</h2>
                <p>ボタンを押すと、猫の写真と偉人の名言がひとつずつ届きます。何度でも引き直せます。</p>
              </div>
            )}
          </div>
        </article>

        <div className="actions">
          <button className="draw-button" onClick={drawToday} disabled={isLoading}>
            <PawIcon />
            {isLoading ? '猫を呼んでいます…' : cat ? 'もう1枚' : '本日の1枚'}
          </button>
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </main>

      <footer className="credits">
        <p>
          写真 <a href="https://thecatapi.com/" target="_blank" rel="noreferrer">TheCatAPI</a>
          <span aria-hidden="true"> ・ </span>
          名言出典 <a href="https://tomo8language.com/quotes-list/" target="_blank" rel="noreferrer">tomo8language.com</a>
          {' / '}
          <a href="https://iyashitour.com/meigen/greatman" target="_blank" rel="noreferrer">iyashitour.com</a>
        </p>
      </footer>
    </div>
  )
}

export default App
