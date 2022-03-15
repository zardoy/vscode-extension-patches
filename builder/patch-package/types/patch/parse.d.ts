export interface HunkHeader {
    original: {
        start: number;
        length: number;
    };
    patched: {
        start: number;
        length: number;
    };
}
export declare const parseHunkHeaderLine: (headerLine: string) => HunkHeader;
export declare const NON_EXECUTABLE_FILE_MODE = 420;
export declare const EXECUTABLE_FILE_MODE = 493;
declare type FileMode = typeof NON_EXECUTABLE_FILE_MODE | typeof EXECUTABLE_FILE_MODE;
interface PatchMutationPart {
    type: "context" | "insertion" | "deletion";
    lines: string[];
    noNewlineAtEndOfFile: boolean;
}
interface FileRename {
    type: "rename";
    fromPath: string;
    toPath: string;
}
interface FileModeChange {
    type: "mode change";
    path: string;
    oldMode: FileMode;
    newMode: FileMode;
}
export interface FilePatch {
    type: "patch";
    path: string;
    hunks: Hunk[];
    beforeHash: string | null;
    afterHash: string | null;
}
interface FileDeletion {
    type: "file deletion";
    path: string;
    mode: FileMode;
    hunk: Hunk | null;
    hash: string | null;
}
interface FileCreation {
    type: "file creation";
    mode: FileMode;
    path: string;
    hunk: Hunk | null;
    hash: string | null;
}
export declare type PatchFilePart = FilePatch | FileDeletion | FileCreation | FileRename | FileModeChange;
export declare type ParsedPatchFile = PatchFilePart[];
interface FileDeets {
    diffLineFromPath: string | null;
    diffLineToPath: string | null;
    oldMode: string | null;
    newMode: string | null;
    deletedFileMode: string | null;
    newFileMode: string | null;
    renameFrom: string | null;
    renameTo: string | null;
    beforeHash: string | null;
    afterHash: string | null;
    fromPath: string | null;
    toPath: string | null;
    hunks: Hunk[] | null;
}
export interface Hunk {
    header: HunkHeader;
    parts: PatchMutationPart[];
}
export declare function interpretParsedPatchFile(files: FileDeets[]): ParsedPatchFile;
export declare function parsePatchFile(file: string): ParsedPatchFile;
export declare function verifyHunkIntegrity(hunk: Hunk): void;
export {};
