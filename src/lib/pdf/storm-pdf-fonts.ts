/**
 * Registers Orbitron for Storm PDF wordmarks — same family as the in-app
 * STORM navbar logo (`StormChainWordmark`). Import this module once before
 * any `renderToBuffer` call (StormPdfChrome does it at load time).
 */
import path from 'node:path'
import { Font } from '@react-pdf/renderer'

const orbitronPath = path.join(process.cwd(), 'public/fonts/Orbitron-SemiBold.ttf')

Font.register({
  family: 'Orbitron',
  fonts: [{ src: orbitronPath, fontWeight: 600 }],
})
