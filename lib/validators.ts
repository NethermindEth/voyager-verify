import { BigNumber, utils } from 'ethers'
import { compilerVersions, COMPILER_VERSION, LICENSE, licenses, NETWORK, networkNames } from "./constants.js"
import { doesClassExist, doesContractExist } from "./requests.js"

export const validateContractOrClassAddressExistence = async (network: NETWORK, address: string) => {
    const result = await Promise.all([doesContractExist(network, address), doesClassExist(network, address)])
    return result.some(x => x === true)
}

export const validateContractOrClassAddress = (address: string) => utils.isHexString(address) 
export const validateNetwork = (network: NETWORK) => networkNames.includes(network)
export const validateCompilerVersion = (version: COMPILER_VERSION) => compilerVersions.includes(version)
export const validateLicense = (license: LICENSE) => licenses.includes(license)
export const validateCairoFileName = (fileName: string) => fileName.endsWith('.cairo')
export const validateNonEmptyString = (string: string) => string.trim().length !== 0

