import { BigNumber, utils } from "ethers";
import fs from "fs";
import path from "path";
import TOML from "@iarna/toml";
import { Spinner } from "cli-spinner";
import {
  NILE_FOLDER_NAME,
  PROTOSTAR_FILE_NAME,
  pythonVersions,
} from "./constants.js";

export const getCurrentDirectoryBase = () => {
  return path.basename(process.cwd());
};

export const directoryExists = (filePath) => {
  return fs.existsSync(filePath);
};

export const normalizeContractOrClassAddress = (address: string) => {
  return utils.hexZeroPad(BigNumber.from(address).toHexString(), 32);
};

export const withSpinner = async (
  spinnerMessage: string,
  promise: Promise<any>
) => {
  const spinner = new Spinner(`${spinnerMessage} %s`);
  spinner.setSpinnerString("|/-\\");
  spinner.start();

  const result = await promise.finally(() => spinner.stop(true));

  return result;
};

export const extractCairoContractName = (name: string) => {
  const parsedPath = path.parse(name)
  return parsedPath.name
};

export const extractFilesForVerification = (contractPath: string) => {
  const CONTRACT_IMPORT_REGEX = /^from (?!starkware)(.*) import/gm;
  const files = [];
  const notFound = [];

  const pathsToExtract = [contractPath];
  while (pathsToExtract.length) {
    const filePath = pathsToExtract.pop();

    const exists = fs.existsSync(filePath);
    if (exists) {
      const contractContents: string = fs.readFileSync(filePath, "utf-8");

      const contract = { path: filePath, content: contractContents };
      files.push(contract);

      const dependencies = [
        ...contractContents.matchAll(CONTRACT_IMPORT_REGEX),
      ].flatMap((x) => {
        const split = x[1].split(".");
        const fullPath = path.join(...split) + ".cairo";

        return fullPath;
      });

      pathsToExtract.push(...dependencies);
    } else {
      notFound.push(filePath);
    }
  }

  if (notFound.length) {
    throw new Error(
      `The following files have not been found, please provide them.: ${notFound.join(
        ", "
      )}`
    );
  }

  return { files, notFound };
};

export const extractNileForVerification = () => {
  const { VIRTUAL_ENV } = process.env;
  return VIRTUAL_ENV
    ? pythonVersions
        .map((version) =>
          path.join(VIRTUAL_ENV, "lib", version, "site-packages")
        )
        .find((path) => fs.existsSync(path)) || null
    : null;
};

export const extractProtostarForVerification = () => {
  if (fs.existsSync(PROTOSTAR_FILE_NAME)) {
    const protostar = TOML.parse(fs.readFileSync(PROTOSTAR_FILE_NAME, "utf-8"));
    return [
      ...(protostar["protostar.build"]?.["cairo-path"] || []),
      ...(protostar["protostar.shared_command_configs"]?.["cairo-path"] || []),
    ];
  } else {
    return null;
  }
};
