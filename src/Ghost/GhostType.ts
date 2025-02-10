export interface GhostInfo {
    player?: string,
    map?: string,
    // time format should be in "mm:ss.ms"
    time?: string,
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
    sound?: GhostSound[],
}

export interface GhostSound {
    name: string,
    volume: number,
    attentuation: number,
}

export type Vec3 = number[];

export type Vec2 = number[];

export type GhostType = "simen";