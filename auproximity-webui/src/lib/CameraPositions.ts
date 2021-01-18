import { MapID } from '@skeldjs/constant'

export const CameraPositions = {
  [MapID.TheSkeld]: [
    {
      x: -17.8,
      y: -4.8
    },
    {
      x: 13.3,
      y: -4.2
    },
    {
      x: -7.2,
      y: 1.8
    },
    {
      x: 0.6,
      y: -6.5
    }
  ],
  [MapID.MiraHQ]: [],
  [MapID.Polus]: [
    {
      x: 4.8,
      y: -22.6
    },
    {
      x: 24.4,
      y: -8.6
    },
    {
      x: 29.1,
      y: -15.5
    },
    {
      x: 11.6,
      y: -8.3
    },
    {
      x: 15.5,
      y: -15.6
    }
  ],
  [MapID.Airship]: []
}

export function getClosestCamera (position: { x: number; y: number}, map: MapID) {
  const cameras = CameraPositions[map]

  if (cameras.length) {
    let closest = cameras[0]
    let closestDist = Math.hypot(position.x - closest.x, position.y - closest.y)
    for (let i = 1; i < cameras.length; i++) {
      const pos = cameras[i]
      const dist = Math.hypot(position.x - pos.x, position.y - pos.y)

      if (dist < closestDist) {
        closest = pos
        closestDist = dist
      }
    }

    return closest
  }
  return null
}
