export interface GhostInfo {
    name: string,
    frames: GhostFrame[],
}

export interface GhostFrame {
    origin: Vec3,
    viewangles: Vec3,
    frametime?: number,
    buttons: number,
    fov?: number,
    velocity?: Vec3,
    viewheight?: number,
}

export type Vec3 = number[];

export type Vec2 = number[];

export type GhostType = "simen";