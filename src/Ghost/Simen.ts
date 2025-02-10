import { GhostFrame, GhostInfo, Vec2 } from "./GhostType";

export interface SimenGhostFrame {
    frame: GhostFrame,
    moves: Vec2,
}

export interface SimenGhostHeader {
    time: string,
    name: string,
    steamid: string,
    date: string,
    location: string,
    unknown: string,
}

export interface SimenGhost {
    header: SimenGhostHeader,
    frames: SimenGhostFrame[],
}

const _SimenGhostParse = (data: string): SimenGhost => {
    const lines = data.split("\n");
    let frames: SimenGhostFrame[] = [];
    let line_counter = 0;

    // read frames
    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i];
        const maybe_frame = frame(line);

        // error means we are at the "header" now
        if (maybe_frame == "error") {
            break;
        }

        frames.push(maybe_frame);

        line_counter += 1;
    }

    // read header
    const header = header_sequence(lines.slice(line_counter));

    const simen_ghost: SimenGhost = {
        header,
        frames
    }

    return simen_ghost;
}

export const SimenGhostParse = (name: string, data: string): GhostInfo => {
    const simen_ghost = _SimenGhostParse(data);

    // convert time
    // todo, make it work for time above 60 minutes by not being lazy and do some basic mathematics
    const time = new Date(parseFloat(simen_ghost.header.time) * 1000).toISOString().slice(14, 22);

    const ghost_info: GhostInfo = {
        player: simen_ghost.header.name.trim(),
        map: name.replace(".txt", ""),
        time,
        frames: simen_ghost.frames.map(simen_ghost_frame => simen_ghost_frame.frame)
    };

    return ghost_info;
}

type FrameResult = SimenGhostFrame | "error";

const frame = (line: string): FrameResult => {
    const stuffs = line.split(" ");

    if (stuffs.length !== 11) {
        return "error";
    }

    const origin = [Number.parseFloat(stuffs[2]), Number.parseFloat(stuffs[3]), Number.parseFloat(stuffs[4])];
    const viewangles = [Number.parseFloat(stuffs[0]), Number.parseFloat(stuffs[1]), 0.];
    const velocity = [Number.parseFloat(stuffs[5]), Number.parseFloat(stuffs[6]), Number.parseFloat(stuffs[7])];

    const frame: GhostFrame = {
        origin,
        viewangles,
        velocity,
        buttons: Number.parseInt(stuffs[8]),
    }

    const simen_frame: SimenGhostFrame = {
        frame,
        moves: [Number.parseFloat(stuffs[9]), Number.parseFloat(stuffs[10])]
    }

    return simen_frame;
}

const header_sequence = (lines: string[]): SimenGhostHeader => {
    console.assert(lines.length >= 6, "simen ghost header has less than 6 lines")

    const time = lines[0].trim(); // in seconds
    const name = lines[1].trim();
    const steamid = lines[2].trim();
    const date = lines[3].trim();
    const location = lines[4].trim();
    const unknown = lines[5].trim();

    const header: SimenGhostHeader = {
        time,
        name,
        steamid,
        date,
        location,
        unknown,
    };

    return header;
}