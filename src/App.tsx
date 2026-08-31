import { useState } from 'react'

type Cat = {
  name: string
  title: string
  emoji: string
  color: string
  message: string
}

type Fortune = {
  label: string
  icon: string
  score: number
  text: string
}

const cats: Cat[] = [
  { name: 'こむぎ', title: '陽だまりの案内猫', emoji: '🐈', color: '#e8aa65', message: 'ゆっくりで大丈夫。今日は心地よい方を選ぶにゃ。' },
  { name: 'しらたま', title: '月夜のまねき猫', emoji: '🐈‍⬛', color: '#79849a', message: '小さなひらめきが、うれしい出来事を連れてくるにゃ。' },
  { name: 'あずき', title: 'ご縁を結ぶ猫', emoji: '😺', color: '#b77b67', message: '素直なひと言が、誰かの心をあたためる日だにゃ。' },
  { name: 'みかん', title: '元気を届ける猫', emoji: '😸', color: '#ed9454', message: 'まずは一歩。軽やかに動くほど運が味方するにゃ！' },
  { name: 'くろまめ', title: '幸運を見抜く猫', emoji: '🐱', color: '#554f5c', message: 'いつもと違う道に、思いがけない幸運が隠れているにゃ。' },
  { name: 'さくら', title: '夢みる予言猫', emoji: '😽', color: '#d98d9b', message: '自分をたっぷり褒めると、運気がふわっと花開くにゃ。' },
]

const fortuneTexts = {
  money: ['お財布を整えると臨時の幸運が。', '欲しかった物のお得な情報が届きそう。', '小さな節約が大きな満足につながる日。', '人への親切がめぐって返ってきそう。'],
  love: ['笑顔のあいさつがご縁を近づけます。', '素直な気持ちを伝える絶好のタイミング。', '懐かしい人との会話にときめきの予感。', '自分らしさがいちばんの魅力になる日。'],
  health: ['少し長めのストレッチで気分爽快。', '温かい飲み物が心と体を整えます。', '早めの休息で明日の元気をチャージ。', '好きな音楽に合わせて体を動かして。'],
}

const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)]
const score = () => Math.floor(Math.random() * 3) + 3

function makeFortunes(): Fortune[] {
  return [
    { label: '金運', icon: '◉', score: score(), text: pick(fortuneTexts.money) },
    { label: '恋愛運', icon: '♥', score: score(), text: pick(fortuneTexts.love) },
    { label: '健康運', icon: '✚', score: score(), text: pick(fortuneTexts.health) },
  ]
}

function App() {
  const [cat, setCat] = useState<Cat | null>(null)
  const [fortunes, setFortunes] = useState<Fortune[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  const tellFortune = () => {
    setIsAnimating(true)
    window.setTimeout(() => {
      setCat(pick(cats))
      setFortunes(makeFortunes())
      setIsAnimating(false)
    }, 450)
  }

  return (
    <main>
      <div className="background-word" aria-hidden="true">FORTUNE</div>
      <header>
        <span className="eyebrow">TODAY'S FELINE FORECAST</span>
        <h1>猫さま<span>占い</span></h1>
        <p>今日のあなたを導く猫さまは、どの子？</p>
      </header>

      <section className={`fortune-card ${isAnimating ? 'shuffling' : ''}`} aria-live="polite">
        {!cat ? (
          <div className="welcome">
            <div className="moon">☾<span>✦</span></div>
            <div className="cat-silhouette">🐈</div>
            <h2>猫さまが待っています</h2>
            <p>心を落ち着けて、下のボタンを押してにゃ</p>
          </div>
        ) : (
          <div className="result">
            <div className="cat-panel" style={{ '--cat-color': cat.color } as React.CSSProperties}>
              <span className="sparkle one">✦</span><span className="sparkle two">✧</span>
              <div className="cat-emoji">{cat.emoji}</div>
              <span className="chosen">本日の猫さま</span>
              <h2>{cat.name}</h2>
              <p>{cat.title}</p>
            </div>
            <div className="fortune-panel">
              <div className="fortune-list">
                {fortunes.map((fortune) => (
                  <article key={fortune.label}>
                    <div className="fortune-icon">{fortune.icon}</div>
                    <div className="fortune-copy">
                      <div className="fortune-heading"><h3>{fortune.label}</h3><div className="stars" aria-label={`5段階中${fortune.score}`}>{'★'.repeat(fortune.score)}<span>{'★'.repeat(5 - fortune.score)}</span></div></div>
                      <p>{fortune.text}</p>
                    </div>
                  </article>
                ))}
              </div>
              <blockquote>「{cat.message}」</blockquote>
            </div>
          </div>
        )}
      </section>

      <button className="fortune-button" onClick={tellFortune} disabled={isAnimating}>
        <span>🐾</span>{cat ? 'もう一度占う' : '今日の運勢を占う'}<span>›</span>
      </button>
      <p className="note">何度でも占えるにゃ。ただし、猫さまの気分次第。</p>
      <footer><span>✦</span> MAY THE CATS BE WITH YOU <span>✦</span></footer>
    </main>
  )
}

export default App
