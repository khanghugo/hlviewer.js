import { GhostFrame, GhostInfo, GhostType } from "./GhostType";
import { SimenGhostParse } from "./Simen";

export type ParseGhostResult = GhostInfo | "error";

export const parseGhost = (name: string, data: string, ghost_type: GhostType): ParseGhostResult => {
    if (ghost_type === "simen") {
        return SimenGhostParse(name, data);
    }

    return "error";
}

export type GhostFrameResult = GhostFrame | null;

type GhostFrameIdxResult = number[] | null;
// this entire class is written by DeepSeek because I cba to rewrite my rust code.
// IT IS SUPPOSED TO BE THE OTHER WAY AROUND!!
export class Ghost {
    ghost: GhostInfo | null;

    constructor(name: string, data: string, ghost_type: GhostType) {
        const result = parseGhost(name, data, ghost_type);

        if (result == "error") {
            this.ghost = null;
            return;
        }

        this.ghost = result;
        this.calculateViewHeight();
    }

    private getFrameIdx(time: number, override_frametime?: number): GhostFrameIdxResult {
        if (!this.ghost) {
            console.error("there is no ghost");
            return null;
        }

        const frame0 = this.ghost.frames[0];
        if (!frame0) {
            console.error("there is no frame 0");
            return null;
        }

        // Check if both frame0 frametime and override are undefined
        if (frame0.frametime === undefined && override_frametime === undefined) {
            return null;
        }

        let from_time = 0;
        let to_time = 0;
        let to_index = 0;

        for (let i = 0; i < this.ghost.frames.length; i++) {
            const frame = this.ghost.frames[i];
            let add_time: number;

            if (override_frametime !== undefined) {
                add_time = override_frametime;
            } else {
                if (frame.frametime === undefined) {
                    return null;
                }
                add_time = frame.frametime;
            }

            if (to_time > time) {
                break;
            }

            from_time = to_time;
            to_time += add_time;
            to_index = i;
        }

        if (to_index === this.ghost.frames.length - 1 && time >= to_time) {
            return null;
        }

        return [to_index, from_time, to_time];
    }

    private getGhostFrame(time: number, to_index: number, from_time: number, to_time: number): GhostFrameResult {
        if (!this.ghost) {
            return null;
        }

        if (to_index == 0) {
            return this.ghost.frames[0];
        }

        const to_frame = this.ghost.frames[to_index];
        const from_frame = this.ghost.frames[to_index - 1];

        const target = (time - from_time) / (to_time - from_time);
        const clampedTarget = Math.max(0, Math.min(1, target));

        // Interpolate origin
        const new_origin = Ghost.lerp(from_frame.origin, to_frame.origin, clampedTarget);

        // Calculate viewangles difference
        const viewangles_diff = [
            this.angleDiff(from_frame.viewangles[0], to_frame.viewangles[0]),
            this.angleDiff(from_frame.viewangles[1], to_frame.viewangles[1]),
            this.angleDiff(from_frame.viewangles[2], to_frame.viewangles[2]),
        ];

        // Interpolate viewangles
        const new_viewangles = [
            from_frame.viewangles[0] + viewangles_diff[0] * clampedTarget,
            from_frame.viewangles[1] + viewangles_diff[1] * clampedTarget,
            from_frame.viewangles[2] + viewangles_diff[2] * clampedTarget,
        ];

        // Interpolate FOV
        let new_fov: number | undefined = undefined;
        if (from_frame.fov !== undefined && to_frame.fov !== undefined) {
            new_fov = Ghost.lerp(from_frame.fov, to_frame.fov, clampedTarget);
        }

        const res: GhostFrameResult = {
            ...from_frame,
            origin: new_origin,
            viewangles: new_viewangles,
            fov: new_fov,
        };

        return res;
    }

    private calculateViewHeight() {
        if (!this.ghost) {
            return;
        }

        // need to handle the on ground too but oh well
        for (let i = 0; i < this.ghost.frames.length; ++i) {
            if (this.ghost.frames[i].viewheight !== undefined) {
                return;
            }

            this.ghost.frames[i].viewheight = 28;
            
            const is_duck = this.ghost.frames[i].buttons & (1 << 2);

            if (is_duck) {
                this.ghost.frames[i].viewheight = 12;
            }
        }
    }

    getFrame(time: number, override_frametime?: number): GhostFrameResult {
        const _res = this.getFrameIdx(time, override_frametime);

        if (!_res
            // already checked in the getFrameIdx 
            || !this.ghost) {
            return null;
        }

        const [to_index, from_time, to_time] = _res;

        return this.getGhostFrame(time, to_index, from_time, to_time);
    }

    // returns the length of the ghost
    // TODO: maybe not hardcoded for simen
    length(): number {
        if (!this.ghost) {
            return 0;
        }

        const FRAMETIME = 0.01;

        return FRAMETIME * this.ghost.frames.length;
    }

    private angleDiff(a: number, b: number): number {
        let diff = b - a;
        diff = ((diff + 180) % 360 + 360) % 360 - 180;
        return diff;
    }

    /**
     * Linear interpolation between two numbers.
     * @param a - Start value.
     * @param b - End value.
     * @param t - Interpolation factor (0 to 1).
     * @returns Interpolated value.
     */
    static lerp(a: number, b: number, t: number): number;

    /**
     * Linear interpolation between two arrays of numbers.
     * @param a - Start array.
     * @param b - End array.
     * @param t - Interpolation factor (0 to 1).
     * @returns Interpolated array.
     */
    static lerp(a: number[], b: number[], t: number): number[];

    static lerp(a: number | number[], b: number | number[], t: number): number | number[] {
        const l = (a: number, b: number, t: number) => a + t * ( b - a );

        if (Array.isArray(a) && Array.isArray(b)) {
            return a.map((val, i) => l(val, b[i], t));
        } else if (typeof a === 'number' && typeof b === 'number') {
            return l(a, b, t);
        } else {
            throw new Error('Invalid types for lerp: a and b must both be numbers or arrays of numbers.');
        }
    }
}