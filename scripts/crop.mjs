import { PNG } from 'pngjs'
import { readFileSync, writeFileSync } from 'node:fs'
const [input, x, y, w, h, out] = process.argv.slice(2)
const src = PNG.sync.read(readFileSync(input))
const X = Number(x), Y = Number(y), W = Number(w), H = Number(h)
const dst = new PNG({ width: W, height: H })
PNG.bitblt(src, dst, X, Y, W, H, 0, 0)
writeFileSync(out, PNG.sync.write(dst))
console.log('wrote', out)
