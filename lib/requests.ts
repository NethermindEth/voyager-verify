import axios from "axios"
import FormData from "form-data"
import { COMPILER_VERSION, LICENSE, NETWORK, urlByNetwork } from "./constants.js"

export const doesContractExist = async (network: NETWORK, address: string) => {
    try {
        const result = await axios.get(`${urlByNetwork[network]}/api/contract/${address}`)
        return result.status === 200
    } catch {
        return false
    }
}

export const doesClassExist = async (network: NETWORK, address: string) => {
    try {
        const result = await axios.get(`${urlByNetwork[network]}/api/class/${address}`)
        return result.status === 200
    } catch {
        return false
    }
}

export const verifyContractOrClass = async (network: NETWORK, address: string, version: COMPILER_VERSION, license: LICENSE, isAccount: boolean, name: string, contractPath: string, files: { path: string, content: string }[]) => {
    const body = new FormData()
    body.append("compiler-version", version)
    body.append("license", license)
    body.append("account-contract", isAccount.toString())
    body.append("name", name)
    body.append("contract-name", contractPath)
    Array.from({ length: files.length }).forEach((_, index) => {
        body.append(`file${index}`, files[index].content, { filename: files[index].path, filepath: files[index].path })
    })

    try {
        const result = await axios.post(`${urlByNetwork[network]}/api/contract/${address}/code`, {
            body,
        }, {
            headers: {
                "content-type": `multipart/form-data boundary=${body.getBoundary()}`,
            }
        })

        return result.data
    } catch (error) {
        throw new Error(error.response.data.message)
    }
}