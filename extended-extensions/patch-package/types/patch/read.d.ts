import { PackageDetails } from "../PackageDetails";
import { PatchFilePart } from "./parse";
export declare function readPatch({ patchFilePath, packageDetails, patchDir, }: {
    patchFilePath: string;
    packageDetails: PackageDetails;
    patchDir: string;
}): PatchFilePart[];
