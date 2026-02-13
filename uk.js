addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const { searchParams } = new URL(request.url)
  const region = searchParams.get('region') || getRandomRegion()
  let address, name, gender, phone

  for (let i = 0; i < 20; i++) {
    const location = getRandomLocationInRegion(region)
    const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.lat}&lon=${location.lng}&zoom=18&addressdetails=1`

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Cloudflare Worker' }
    })
    const data = await response.json()

    if (data && data.address && data.address.road && data.address.city) {
      address = formatAddress(data.address, region)
      break
    }
  }

  if (!address) {
    return new Response('无法获取详细地址', { status: 500 })
  }

  const userData = await fetch('https://randomuser.me/api/?nat=gb')
  const userJson = await userData.json()
  if (userJson && userJson.results && userJson.results.length > 0) {
    const user = userJson.results[0]
    name = `${user.name.first} ${user.name.last}`
    gender = user.gender === 'male' ? '男' : '女'
    phone = generateUKPhoneNumber(region)
  } else {
    name = getRandomName()
    gender = Math.random() < 0.5 ? '男' : '女'
    phone = generateUKPhoneNumber(region)
  }

  const html = `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>英国地址生成器</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body {
        font-family: 'Microsoft YaHei', Arial, sans-serif;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
        min-height: 100vh;
        background-color: #f0f8ff;
        margin: 0;
        color: #333;
      }
      .container {
        text-align: center;
        background: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
        width: 90%;
        max-width: 600px;
        margin: 20px;
        box-sizing: border-box;
        position: relative;
      }
      .info-item {
        font-size: 1.2em;
        margin-bottom: 15px;
        padding: 10px;
        background-color: #f9f9f9;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      .info-item:hover {
        background-color: #e9e9e9;
      }
      .refresh-btn {
        padding: 12px 24px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 1em;
        margin-bottom: 20px;
        transition: background-color 0.3s;
      }
      .refresh-btn:hover {
        background-color: #45a049;
      }
      .region-select {
        margin-bottom: 20px;
      }
      .region-select select {
        padding: 10px;
        font-size: 1em;
        border-radius: 5px;
        border: 1px solid #ddd;
      }
      .map {
        width: 100%;
        height: 300px;
        border: 0;
        border-radius: 10px;
        margin-top: 20px;
      }
      .title {
        font-size: 2.5em;
        margin: 20px 0;
        color: #2c3e50;
      }
      .footer {
        margin-top: auto;
        padding: 10px 0;
        background-color: #f0f8ff;
        width: 100%;
        text-align: center;
        font-size: 0.9em;
      }
      .footer a {
        color: #3498db;
        text-decoration: none;
      }
      .footer a:hover {
        text-decoration: underline;
      }
      .copied {
        position: absolute;
        top: 10px;
        right: 10px;
        background: #28a745;
        color: white;
        padding: 5px 10px;
        border-radius: 5px;
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="title">英国地址生成器</div>
    <div class="container">
      <div class="copied" id="copied">已复制!</div>
      <div class="info-item" onclick="copyToClipboard('${name}')">姓名: ${name}</div>
      <div class="info-item" onclick="copyToClipboard('${gender}')">性别: ${gender}</div>
      <div class="info-item" onclick="copyToClipboard('${phone}')">电话: ${phone}</div>
      <div class="info-item" onclick="copyToClipboard('${address}')">地址: ${address}</div>
      <button class="refresh-btn" onclick="window.location.reload();">生成新地址</button>
      <div class="region-select">
        <label for="region">选择地区:</label>
        <select id="region" onchange="changeRegion(this.value)">
          ${getRegionOptions(region)}
        </select>
      </div>
      <iframe class="map" src="https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed"></iframe>
    </div>
    <div class="footer">
      © xf.do 版权所有 | <a href="https://xf.do" target="_blank">https://xf.do</a>
    </div>
    <script>
      function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
          const copied = document.getElementById('copied')
          copied.style.display = 'block'
          setTimeout(() => {
            copied.style.display = 'none'
          }, 2000)
        })
      }
      function changeRegion(region) {
        window.location.href = \`?region=\${region}\`
      }
    </script>
  </body>
  </html>
  `

  return new Response(html, {
    headers: { 'content-type': 'text/html;charset=UTF-8' },
  })
}

function getRandomLocationInRegion(region) {
  const regionCoordinates = {
    "England": [{ lat: 51.5074, lng: -0.1278 }, { lat: 53.4808, lng: -2.2426 }],
    "Scotland": [{ lat: 55.9533, lng: -3.1883 }, { lat: 57.1497, lng: -2.0943 }],
    "Wales": [{ lat: 51.4816, lng: -3.1791 }, { lat: 53.2304, lng: -4.1297 }],
    "Northern Ireland": [{ lat: 54.5973, lng: -5.9301 }, { lat: 54.9966, lng: -7.3086 }]
  }
  const coordsArray = regionCoordinates[region]
  const randomCity = coordsArray[Math.floor(Math.random() * coordsArray.length)]
  const lat = randomCity.lat + (Math.random() - 0.5) * 0.1
  const lng = randomCity.lng + (Math.random() - 0.5) * 0.1
  return { lat, lng }
}

function formatAddress(address, region) {
  const postcode = generateUKPostcode(region)
  return `${address.house_number || ''} ${address.road}, ${address.city || address.town || address.village}, ${region}, ${postcode}`
}

function generateUKPostcode(region) {
  const areas = {
    "England": ["B", "BD", "BH", "BL", "BN", "BR", "BS", "CB", "CH", "CM", "CO", "CR", "CT", "CV", "CW", "DE", "DH", "DL", "DN", "DY", "E", "EC", "EN", "EX", "FY", "GL", "GU", "HA", "HD", "HG", "HP", "HR", "HU", "HX", "IG", "IP", "KT", "L", "LA", "LE", "LS", "LU", "M", "ME", "MK", "N", "NE", "NG", "NN", "NP", "NR", "NW", "OL", "OX", "PE", "PO", "PR", "RG", "RH", "RM", "S", "SE", "SG", "SK", "SL", "SM", "SN", "SO", "SP", "SR", "SS", "ST", "SW", "SY", "TA", "TN", "TW", "UB", "W", "WA", "WC", "WD", "WF", "WN", "WR", "WS", "WV", "YO"],
    "Scotland": ["AB", "DD", "DG", "EH", "FK", "G", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "TD", "ZE"],
    "Wales": ["CF", "LD", "LL", "NP", "SA", "SY"],
    "Northern Ireland": ["BT"]
  }
  const area = areas[region][Math.floor(Math.random() * areas[region].length)]
  const num1 = Math.floor(Math.random() * 90) + 10
  const num2 = Math.floor(Math.random() * 9) + 1
  const letter1 = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  const letter2 = String.fromCharCode(65 + Math.floor(Math.random() * 26))
  return `${area}${num1} ${num2}${letter1}${letter2}`
}

function generateUKPhoneNumber(region) {
  const format = Math.random() < 0.7 ? 'mobile' : 'landline'  // 70%概率生成手机号码
  
  if (format === 'mobile') {
    // 英国手机号码格式: 07xxx xxxxxx
    const mobilePrefix = ['7','74','75','77','78','79']  // 去掉前导0
    const prefix = '0' + mobilePrefix[Math.floor(Math.random() * mobilePrefix.length)]
    const middle = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
    const end = Math.floor(Math.random() * 1000000).toString().padStart(6, '0')
    return `${prefix}${middle} ${end}`
  } else {
    // 固定电话号码格式基于地区
    const areaCodeMap = {
      "England": [
        "020", // London
        "0121", // Birmingham
        "0151", // Liverpool
        "0161", // Manchester
        "0114", // Sheffield
        "0117", // Bristol
        "0113", // Leeds
        "0115", // Nottingham
      ],
      "Scotland": [
        "0131", // Edinburgh
        "0141", // Glasgow
        "01224", // Aberdeen
        "01382", // Dundee
      ],
      "Wales": [
        "029", // Cardiff
        "01792", // Swansea
        "01248", // Bangor
      ],
      "Northern Ireland": [
        "028", // Northern Ireland
        "02890", // Belfast
        "02871", // Londonderry
      ]
    }

    const areaCodes = areaCodeMap[region]
    const areaCode = areaCodes[Math.floor(Math.random() * areaCodes.length)]
    
    // 根据区号长度生成剩余数字
    const remainingLength = 10 - areaCode.length
    const localNumber = Math.floor(Math.random() * Math.pow(10, remainingLength))
                           .toString()
                           .padStart(remainingLength, '0')
    
    // 根据区号的长度来格式化号码
    if (areaCode.length === 3) { // 例如: 020 XXXX XXXX
      return `${areaCode} ${localNumber.slice(0,4)} ${localNumber.slice(4)}`
    } else if (areaCode.length === 4) { // 例如: 0121 XXX XXXX
      return `${areaCode} ${localNumber.slice(0,3)} ${localNumber.slice(3)}`
    } else { // 5位区号: 02890 XX XXXX
      return `${areaCode} ${localNumber.slice(0,2)} ${localNumber.slice(2)}`
    }
  }
}

function getRandomRegion() {
  const regions = ["England", "Scotland", "Wales", "Northern Ireland"]
  return regions[Math.floor(Math.random() * regions.length)]
}

function getRegionOptions(selectedRegion) {
  const regions = ["England", "Scotland", "Wales", "Northern Ireland"]
  return regions.map(region => 
    `<option value="${region}" ${region === selectedRegion ? 'selected' : ''}>${region}</option>`
  ).join('')
}