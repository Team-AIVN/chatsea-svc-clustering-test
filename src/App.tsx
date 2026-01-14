import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { divIcon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'
import randomData from './assets/random_data_1000.json'

// Type별 색상 매핑 (랜덤으로 지정)
const typeColors: Record<number, string> = {
  1: '#FF6B6B',   // 빨간색
  2: '#4ECDC4',   // 청록색
  3: '#45B7D1',   // 파란색
  4: '#FFA07A',   // 연어색
  5: '#98D8C8',   // 민트색
  6: '#F7DC6F',   // 노란색
  7: '#BB8FCE',   // 보라색
  8: '#85C1E2',   // 하늘색
  9: '#F8B739',   // 주황색
  10: '#52BE80',  // 초록색
}

// Type별 마커 아이콘 생성 함수
const createMarkerIcon = (type: number) => {
  const color = typeColors[type] || '#808080' // 기본값: 회색
  
  return divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

// 클러스터 마커 아이콘 생성 함수 (사각형, 서비스 타입 색상, 클러스터 수 표시)
const createClusterIcon = (count: number, type: number) => {
  const clusterColor = typeColors[type] || '#808080' // 서비스 타입 색상 사용
  const size = Math.max(30, Math.min(50, 20 + count * 2)) // 클러스터 수에 따라 크기 조정
  
  return divIcon({
    className: 'cluster-marker',
    html: `<div style="
      background-color: ${clusterColor};
      width: ${size}px;
      height: ${size}px;
      border-radius: 4px;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: ${size > 40 ? '14px' : '12px'};
      color: white;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

interface DataPoint {
  id: string
  type: number
  latitude: number
  longitude: number
  gh_2?: string
  gh_3?: string
  gh_4?: string
  gh_5?: string
  gh_6?: string
  gh_7?: string
  gh_8?: string
  gh_9?: string
}

interface Cluster {
  geohash: string
  type: number
  points: DataPoint[]
  centerLat: number
  centerLon: number
  count: number
}

function App() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([])
  // 기본값: all이 체크되어 있고, type 1~10 모두 선택
  const [selectedTypes, setSelectedTypes] = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  const [isAllSelected, setIsAllSelected] = useState(true)
  const [geohashNum, setGeohashNum] = useState<string>('None')

  useEffect(() => {
    // JSON 데이터 로드
    if (randomData && randomData.data) {
      setDataPoints(randomData.data)
    }
  }, [])

  // All 체크박스 핸들러
  const handleAllChange = (checked: boolean) => {
    setIsAllSelected(checked)
    if (checked) {
      // All 선택 시 모든 type 선택
      setSelectedTypes(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
    } else {
      // All 해제 시 모든 type 해제
      setSelectedTypes(new Set())
    }
  }

  // 개별 type 체크박스 핸들러
  const handleTypeChange = (type: number, checked: boolean) => {
    const newSelectedTypes = new Set(selectedTypes)
    if (checked) {
      newSelectedTypes.add(type)
    } else {
      newSelectedTypes.delete(type)
      setIsAllSelected(false) // 개별 해제 시 all도 해제
    }
    
    // 모든 type이 선택되었는지 확인
    if (newSelectedTypes.size === 10) {
      setIsAllSelected(true)
    }
    
    setSelectedTypes(newSelectedTypes)
  }

  // 필터링된 데이터
  const filteredDataPoints = useMemo(() => {
    return dataPoints.filter((point) => selectedTypes.has(point.type))
  }, [dataPoints, selectedTypes])

  // 클러스터링 로직 (geohash + type 기준)
  const clusters = useMemo(() => {
    if (geohashNum === 'None') {
      return []
    }

    const geohashKey = `gh_${geohashNum}` as keyof DataPoint
    const clusterMap = new Map<string, DataPoint[]>()

    // 같은 geohash 값과 같은 type을 가진 데이터들을 그룹화
    filteredDataPoints.forEach((point) => {
      const geohashValue = point[geohashKey] as string | undefined
      if (geohashValue) {
        // geohash와 type을 조합한 키 생성
        const clusterKey = `${geohashValue}_type_${point.type}`
        if (!clusterMap.has(clusterKey)) {
          clusterMap.set(clusterKey, [])
        }
        clusterMap.get(clusterKey)!.push(point)
      }
    })

    // 클러스터 생성 (평균 위도, 경도 계산)
    const clusterList: Cluster[] = []
    clusterMap.forEach((points, clusterKey) => {
      if (points.length > 0) {
        const avgLat = points.reduce((sum, p) => sum + p.latitude, 0) / points.length
        const avgLon = points.reduce((sum, p) => sum + p.longitude, 0) / points.length
        // clusterKey에서 geohash와 type 추출
        const [geohash, , typeStr] = clusterKey.split('_')
        const type = parseInt(typeStr, 10)
        clusterList.push({
          geohash,
          type,
          points,
          centerLat: avgLat,
          centerLon: avgLon,
          count: points.length,
        })
      }
    })

    return clusterList
  }, [filteredDataPoints, geohashNum])

  // 데이터의 중심점 계산 (지도 초기 위치 설정용)
  const calculateCenter = () => {
    const pointsToUse = geohashNum === 'None' ? filteredDataPoints : clusters.flatMap(c => c.points)
    
    if (pointsToUse.length === 0) {
      return [37.5665, 126.9780] as [number, number] // 기본값: 서울
    }

    const avgLat = pointsToUse.reduce((sum, point) => sum + point.latitude, 0) / pointsToUse.length
    const avgLon = pointsToUse.reduce((sum, point) => sum + point.longitude, 0) / pointsToUse.length
    return [avgLat, avgLon] as [number, number]
  }

  // Type별 아이콘 캐시 (성능 최적화)
  const iconCache = useMemo(() => {
    const cache: Record<number, ReturnType<typeof createMarkerIcon>> = {}
    dataPoints.forEach((point) => {
      if (!cache[point.type]) {
        cache[point.type] = createMarkerIcon(point.type)
      }
    })
    return cache
  }, [dataPoints])

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>ChatSea Service Clustering Test View</h1>
          <div className="type-filter">
            <span className="filter-section-label">Service type:</span>
            <label className="filter-label">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={(e) => handleAllChange(e.target.checked)}
              />
              <span>All</span>
            </label>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((type) => (
              <label key={type} className="filter-label">
                <input
                  type="checkbox"
                  checked={selectedTypes.has(type)}
                  onChange={(e) => handleTypeChange(type, e.target.checked)}
                />
                <span
                  className="type-label"
                  style={{ color: typeColors[type] }}
                >
                  Type {type}
                </span>
              </label>
            ))}
          </div>
          <div className="geohash-filter">
            <span className="filter-section-label">geohash num:</span>
            <select
              className="geohash-select"
              value={geohashNum}
              onChange={(e) => setGeohashNum(e.target.value)}
            >
              <option value="None">None</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
            </select>
          </div>
        </div>
      </header>
      <main className="app-main">
        <MapContainer
          center={calculateCenter()}
          zoom={8}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <TileLayer
            attribution='&copy; <a href="https://www.openseamap.org">OpenSeaMap</a> contributors'
            url="https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png"
            opacity={0.8}
          />
          {geohashNum === 'None' ? (
            // None 선택 시: 개별 마커 표시
            filteredDataPoints.map((point) => (
              <Marker
                key={point.id}
                position={[point.latitude, point.longitude]}
                icon={iconCache[point.type] || createMarkerIcon(point.type)}
              >
                <Popup>
                  <div>
                    <strong>ID:</strong> {point.id}<br />
                    <strong>Type:</strong> <span style={{ color: typeColors[point.type] || '#808080', fontWeight: 'bold' }}>{point.type}</span><br />
                    <strong>Lat:</strong> {point.latitude.toFixed(6)}<br />
                    <strong>Lon:</strong> {point.longitude.toFixed(6)}
                  </div>
                </Popup>
              </Marker>
            ))
          ) : (
            // 숫자 선택 시: 클러스터 마커 표시 (개수가 1이면 일반 마커, 2 이상이면 클러스터 마커)
            clusters.map((cluster) => {
              const isSinglePoint = cluster.count === 1
              const point = isSinglePoint ? cluster.points[0] : null
              
              return (
                <Marker
                  key={`${cluster.geohash}_type_${cluster.type}`}
                  position={[cluster.centerLat, cluster.centerLon]}
                  icon={isSinglePoint 
                    ? (iconCache[cluster.type] || createMarkerIcon(cluster.type))
                    : createClusterIcon(cluster.count, cluster.type)
                  }
                >
                  <Popup>
                    <div>
                      {isSinglePoint && point ? (
                        <>
                          <strong>ID:</strong> {point.id}<br />
                          <strong>Type:</strong> <span style={{ color: typeColors[cluster.type] || '#808080', fontWeight: 'bold' }}>{cluster.type}</span><br />
                          <strong>Lat:</strong> {point.latitude.toFixed(6)}<br />
                          <strong>Lon:</strong> {point.longitude.toFixed(6)}
                        </>
                      ) : (
                        <>
                          <strong>Geohash:</strong> {cluster.geohash}<br />
                          <strong>Type:</strong> <span style={{ color: typeColors[cluster.type] || '#808080', fontWeight: 'bold' }}>{cluster.type}</span><br />
                          <strong>Count:</strong> {cluster.count}<br />
                          <strong>Center Lat:</strong> {cluster.centerLat.toFixed(6)}<br />
                          <strong>Center Lon:</strong> {cluster.centerLon.toFixed(6)}
                        </>
                      )}
                    </div>
                  </Popup>
                </Marker>
              )
            })
          )}
        </MapContainer>
      </main>
    </div>
  )
}

export default App
