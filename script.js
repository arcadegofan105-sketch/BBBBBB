// ===== CONFIG =====
const API_URL = '/api'
const wheelSectors = [
  { emoji: '📅', name: 'Календарь', price: 1.5 },
  { emoji: '🐸', name: 'Пепе', price: 0.0 },
  { emoji: '💋', name: 'Губы', price: 0.0 },
  { emoji: '🧸', name: 'Мишка', price: 0.1 },
  { emoji: '🍀', name: 'Клевер', price: 0.0 },
  { emoji: '🍑', name: 'Персик', price: 0.0 }
]

// ===== CUSTOM IMAGES =====
const GIFT_IMAGES = {
  'Пепе': 'epepepepe.webp',
  'Персик': 'epersok.webp',
}

function giftVisual(item) {
  const file = GIFT_IMAGES[item?.name]
  if (file) return `<span class=\"gift-icon\" style=\"background-image:url('${file}')\"></span>`
  return item?.emoji || '🎁'
}

// ===== DOM ELEMENTS =====
const canvas = document.getElementById('wheel')
const ctx = canvas.getContext('2d')
const spinBtn = document.getElementById('spin-btn')
const resultDiv = document.getElementById('result')

let isSpinning = false
let currentAngle = 0

// ===== DRAW WHEEL =====
function drawWheel() {
  const centerX = canvas.width / 2
  const centerY = canvas.height / 2
  const radius = canvas.width / 2 - 10
  const anglePerSector = (2 * Math.PI) / wheelSectors.length

  wheelSectors.forEach((sector, i) => {
    const startAngle = currentAngle + i * anglePerSector
    const endAngle = startAngle + anglePerSector

    // Рисуем сектор
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, startAngle, endAngle)
    ctx.closePath()
    ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#ff6347'
    ctx.fill()
    ctx.stroke()

    // Рисуем текст
    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate(startAngle + anglePerSector / 2)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#000'
    ctx.font = '20px Arial'
    ctx.fillText(sector.emoji, radius * 0.7, 0)
    ctx.restore()
  })

  // Указатель
  ctx.beginPath()
  ctx.moveTo(centerX + radius - 20, centerY)
  ctx.lineTo(centerX + radius + 20, centerY - 10)
  ctx.lineTo(centerX + radius + 20, centerY + 10)
  ctx.closePath()
  ctx.fillStyle = '#000'
  ctx.fill()
}

// ===== SPIN =====
function spin() {
  if (isSpinning) return
  isSpinning = true
  spinBtn.disabled = true
  resultDiv.textContent = 'Крутим...'

  // Запрос к серверу
  fetch('/spin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        const targetSector = data.sector
        animateWheel(targetSector)
      } else {
        resultDiv.textContent = 'Ошибка!'
        isSpinning = false
        spinBtn.disabled = false
      }
    })
    .catch(err => {
      console.error(err)
      resultDiv.textContent = 'Ошибка соединения'
      isSpinning = false
      spinBtn.disabled = false
    })
}

function animateWheel(targetSector) {
  const anglePerSector = (2 * Math.PI) / wheelSectors.length
  const targetAngle = targetSector * anglePerSector
  const fullRotations = 5 * 2 * Math.PI
  const finalAngle = fullRotations + targetAngle

  const startTime = Date.now()
  const duration = 3000

  function animate() {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    const easeOut = 1 - Math.pow(1 - progress, 3)

    currentAngle = easeOut * finalAngle
    drawWheel()

    if (progress < 1) {
      requestAnimationFrame(animate)
    } else {
      showResult(targetSector)
    }
  }

  animate()
}

function showResult(sectorIndex) {
  const sector = wheelSectors[sectorIndex]
  resultDiv.innerHTML = `Выпало: ${giftVisual(sector)} ${sector.name} (${sector.price} TON)`
  isSpinning = false
  spinBtn.disabled = false
}

// ===== INIT =====
canvas.width = 400
canvas.height = 400
drawWheel()
spinBtn.addEventListener('click', spin)

