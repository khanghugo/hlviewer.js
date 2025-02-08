import { GhostFrame, GhostInfo, GhostSound, GhostType, Vec3 } from "./GhostType";
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
    forced_frametime: number | null;

    constructor(name: string, data: string, ghost_type: GhostType) {
        const result = parseGhost(name, data, ghost_type);

        this.forced_frametime = 0.01;

        if (result == "error") {
            this.ghost = null;
            return;
        }

        this.ghost = result;
        this.calculateViewHeight();
        this.calculateVelocity();
        this.addStepSound();
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
            // inherit sound from either to make sure we have sound
            sound: from_frame.sound || to_frame.sound || undefined,
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

    private calculateVelocity() {
        if (!this.ghost || this.forced_frametime === null) {
            return;
        }

        let last_origin = [0, 0, 0];

        for (let i = 0; i < this.ghost.frames.length; ++i) {
            // there is already velocity, no need to calculate
            if (this.ghost.frames[i].velocity === undefined) {
                return;
            }

            if (i == 0) {
                this.ghost.frames[i].velocity = [0, 0, 0];
                last_origin = this.ghost.frames[i].origin;
                continue;
            }

            const velocity = [
                (this.ghost.frames[i].origin[0] - last_origin[0]) / this.forced_frametime,
                (this.ghost.frames[i].origin[1] - last_origin[1]) / this.forced_frametime,
                (this.ghost.frames[i].origin[2] - last_origin[2]) / this.forced_frametime,
            ]

            this.ghost.frames[i].velocity = velocity;
            last_origin = this.ghost.frames[i].origin;
        }
    }

    private addStepSound() {
        if (!this.ghost) {
            return;
        }

        const STEP_TIME_CONST = 0.3;

        let step_time = STEP_TIME_CONST;
        let last_vel = [0, 0, 0];

        const getStepSoundFile = () => `player/pl_step${Math.abs(randRange(1, 4))}.wav`;

        for (let i = 0; i < this.ghost.frames.length; ++i) {
            // no velocity to calculate this
            if (this.ghost.frames[i].velocity === undefined) {
                return;
            }

            const velocity = this.ghost.frames[i].velocity as Vec3;

            if (i == 0) {
                last_vel = velocity;
                // no need to add sound because it can be empty
                continue;
            }

            const speed = Math.sqrt(velocity[0] * velocity[0] + velocity[1] * velocity[1]);

            // if speed is less than 150 then increase time_step
            // not sure why it is like this. I just copy from my previous work
            if (speed < 150) {
                step_time = STEP_TIME_CONST + 0.1;
            }

            // jump sound
            const probably_jumping = (velocity[2] - last_vel[2]) > 210; // too OP?
            if (probably_jumping || 
                ((this.ghost.frames[i].buttons & (1 << 1)) != 0 && velocity[2] > last_vel[2] && speed > 150)) {
                if (!this.ghost.frames[i].sound) {
                    this.ghost.frames[i].sound = [];
                }

                const new_sound: GhostSound = {
                    name: getStepSoundFile(),
                    volume: 128,
                    attentuation: 204
                }

                this.ghost.frames[i].sound?.push(new_sound);
            }

            // step sound
            if (step_time <= 0. && velocity[2] == 0) {
                // reset step time
                step_time = STEP_TIME_CONST;

                if (!this.ghost.frames[i].sound) {
                    this.ghost.frames[i].sound = [];
                }

                const new_sound: GhostSound = {
                    name: getStepSoundFile(),
                    volume: 128,
                    attentuation: 204
                }

                this.ghost.frames[i].sound?.push(new_sound);
            }

            last_vel = velocity;
            step_time -= this.forced_frametime || 0.01;
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
        const l = (a: number, b: number, t: number) => a + t * (b - a);

        if (Array.isArray(a) && Array.isArray(b)) {
            return a.map((val, i) => l(val, b[i], t));
        } else if (typeof a === 'number' && typeof b === 'number') {
            return l(a, b, t);
        } else {
            throw new Error('Invalid types for lerp: a and b must both be numbers or arrays of numbers.');
        }
    }
}

// start and end inclusive
const randRange = (start: number, end: number) => {
    let r = Math.random();

    return Math.round(r * (end - start) + start);
} 