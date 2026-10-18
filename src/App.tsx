import { useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { LevaPanel, folder, useControls, useCreateStore } from 'leva'
import * as THREE from 'three'
import { Scene } from './components/Scene'
import { detectQuality, resolveQuality, type QualityMode, type SceneSettings } from './lib/quality'
import './styles.css'

const GL_SETTINGS = {
  antialias: false,
  alpha: false,
  powerPreference: 'high-performance' as const,
  toneMapping: THREE.ACESFilmicToneMapping,
  outputColorSpace: THREE.SRGBColorSpace,
} as const

function LoadingVeil() {
  const { active, progress } = useProgress()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (active) setHidden(false)
    // Never let a stalled HDR / network request trap the scene behind the veil.
    const timer = window.setTimeout(() => setHidden(true), active ? 6000 : 700)
    return () => window.clearTimeout(timer)
  }, [active])

  return (
    <div className={`veil${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <div className="veil-inner">
        <span className="eyebrow">RESIN SPECIMEN · NO. 07</span>
        <span className="veil-title">Pouring the sea</span>
        <div className="veil-bar">
          <i style={{ transform: `scaleX(${Math.min(progress, 100) / 100})` }} />
        </div>
      </div>
    </div>
  )
}

function Overlay() {
  return (
    <div className="overlay">
      <header className="masthead">
        <p className="eyebrow">RESIN SPECIMEN · NO. 07</p>
        <h1>微缩海岛</h1>
        <p className="sub">
          A pocket-sized coast — sea cliffs, a crescent beach and a living
          turquoise tide, sealed in a block of resin.
        </p>
      </header>

      <p className="hint">
        <span className="hint-dot" />
        拖动旋转镜头 · 移动鼠标扰动水面，让海水轻轻晃动
      </p>

      <p className="meta">PROCEDURAL STUDY · THREE.JS / R3F</p>
    </div>
  )
}

export default function App() {
  const baseQuality = useMemo(() => detectQuality(), [])
  const levaStore = useCreateStore()

  const { qualityMode } = useControls(
    '画质',
    {
      qualityMode: {
        value: baseQuality.low ? 'lite' : 'full',
        options: {
          '轻量 60 帧': 'lite',
          '完整玻璃 30 帧': 'full',
          '极致画质': 'ultra',
        },
        label: '渲染模式',
      },
    },
    { store: levaStore },
  )

  const quality = useMemo(
    () => resolveQuality(baseQuality, qualityMode as QualityMode),
    [baseQuality, qualityMode],
  )

  const controls = useControls('树脂标本', {
    水体: folder({
      shallowColor: { value: '#3ed8c4', label: '浅水色' },
      deepColor: { value: '#07546d', label: '深水色' },
      foamColor: { value: '#f4fbf8', label: '泡沫色' },
    }),
    波浪: folder({
      waveHeight: { value: 0.7, min: 0, max: 1.6, step: 0.01, label: '浪高' },
      rippleStrength: { value: 1.25, min: 0, max: 3, step: 0.01, label: '涟漪强度' },
      rippleHeight: { value: 0.55, min: 0.05, max: 1, step: 0.01, label: '涟漪位移' },
    }),
    光照: folder({
      sunAngle: { value: 55, min: 0, max: 360, step: 1, label: '太阳方位' },
      sunElevation: { value: 42, min: 8, max: 82, step: 1, label: '太阳高度' },
    }),
    潮位: folder({
      tide: { value: -0.03, min: -0.18, max: 0.18, step: 0.005, label: '潮位' },
    }),
    果冻: folder({
      jellySoftness: { value: 0.42, min: 0, max: 1, step: 0.01, label: '软硬' },
      jellyAmount: { value: 1, min: 0, max: 1.6, step: 0.01, label: '晃动幅度' },
    }),
    景深: folder({
      dofFocus: { value: 33, min: 8, max: 50, step: 0.1, label: '对焦距离' },
      dofRange: { value: 5, min: 0.5, max: 20, step: 0.1, label: '景深范围' },
      dofBlur: { value: 0.7, min: 0, max: 8, step: 0.05, label: '虚化强度' },
    }),
    后期: folder({
      bloom: { value: 0.16, min: 0, max: 1.5, step: 0.01, label: '泛光' },
      exposure: { value: 0.86, min: 0.4, max: 2, step: 0.01, label: '曝光' },
    }),
  }, { store: levaStore })

  const settings = controls as unknown as SceneSettings

  return (
    <div className="app">
      <Canvas
        className="canvas"
        dpr={quality.dpr}
        gl={GL_SETTINGS}
        camera={{ fov: 24, near: 0.5, far: 400, position: [11, 11.5, 11.9] }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = settings.exposure
        }}
      >
        <Scene settings={settings} quality={quality} />
      </Canvas>

      <LevaPanel
        store={levaStore}
        collapsed={quality.mobile}
        titleBar={{ title: "树脂标本" }}
      />
      <LoadingVeil />
      <Overlay />
    </div>
  )
}
