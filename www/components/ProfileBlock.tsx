import Head from 'next/head'
import "../flow.config.js"
import { useState, useEffect } from "react";
import * as fcl from "@onflow/fcl";

// 0xProfile contract
interface Profile {
    address: string // "0x0b66bcec6dcf4002"
    avatar: string // ""
    color: string // "#ffff00"
    info: string // "likes ramen"
    name: string // "andrew"
}

// -- FCL -- 
interface User {
    loggedIn: boolean | null,
    addr: string | null,
    // has other stuff too... but none useful atm lol
}

interface TransactionStatus {
    blockId: string,
    errorMessage: string,
    events: {
        type: string, //, 'A.7e60df042a9c0868.FlowToken.TokensWithdrawn', 
        transactionId: string, //'da14391347403238aa17975c9321a3ef370eaabb017847485a1d825a62c17d1c', 
        transactionIndex: 0,
        eventIndex: 0,
        data: {
            amount: string, // "0.00000284"
            from: string, // "0xf086a545ce3c552d"
        }
    }[],
    status: number, // 3
    statusCode: number, // 0
    statusString: string, // "EXECUTED"
}
// END FCL


export function ProfileBlock() {

    const [user, setUser] = useState<User>({ loggedIn: null, addr: null })
    const [profile, setProfile] = useState<Profile | null>(null)
    const [transactionStatus, setTransactionStatus] = useState<TransactionStatus | null>(null)

    useEffect(() => {
        fcl.currentUser.subscribe(setUser)
    }, [])

    const queryProfileData = async () => {
        const onChainProfile = await fcl.query({
            cadence: `
                import Profile from 0xProfile

                pub fun main(address: Address): Profile.ReadOnly? {
                    return Profile.read(address)
                }
            `,
            args: (arg, t) => [arg(user.addr, t.Address)]
        })

        if (onChainProfile) {
            setProfile({ ...onChainProfile })
        }
    }

    const sendCreateProfileTransaction = async () => {
        // xx -- could just init data here instead ya?

        const transactionId = await fcl.mutate({
            cadence: `

            import Profile from 0xProfile

            transaction {

                prepare(account: AuthAccount) {
                    if (!Profile.check(account.address)) {
                        // adds profile resource to account
                        account.save(<- Profile.new(), to: Profile.privatePath)

                        // makes the profile resource publicly readable
                        account.link<&Profile.Base{Profile.Public}>(Profile.publicPath, target: Profile.privatePath)
                    }
                }
            }

            `,
            payer: fcl.authz,
            proposer: fcl.authz,
            authorizations: [fcl.authz],
            limit: 500
        })

        // should subscribe instead.
        const transaction = await fcl.tx(transactionId).onceSealed()
        console.log(transaction)
    }

    const sendUpdateProfileTransaction = async () => {
        const transactionId = await fcl.mutate({
            cadence: `

            import Profile from 0xProfile

            transaction(name: String, info: String) {

                prepare(account: AuthAccount) {
                    account
                    .borrow<&Profile.Base{Profile.Owner}>(from: Profile.privatePath)!
                    .setName(name)

                    account
                    .borrow<&Profile.Base{Profile.Owner}>(from: Profile.privatePath)!
                    .setInfo(info)
                }

            }

            `,
            args: (arg, t) => [arg("andrew", t.String), arg("realnoiselabs", t.String)],
            payer: fcl.authz,
            proposer: fcl.authz,
            authorizations: [fcl.authz],
            limit: 500
        })

        fcl.tx(transactionId).subscribe(res => {
            console.log("xxx", { res });
            setTransactionStatus(res.status)
        })
    }

    return (
        <div>

            <Head>
                <title>FCL Quickstart with NextJS</title>
                <meta name="description" content="My first web3 app on Flow!" />
                <link rel="icon" href="/favicon.png" />
            </Head>

            <h1>Flow App</h1>

            {user.loggedIn
                ?
                <div>
                    <div>Address: {user.addr}</div>
                    <div>Profile Name: {profile?.name || "---"}</div>
                    <div>Info: {profile?.info || "---"}</div>

                    <button onClick={queryProfileData}>Get Profile Data</button>

                    <button onClick={sendCreateProfileTransaction}>Create Profile</button>

                    <button onClick={sendUpdateProfileTransaction}>Update Profile Info</button>

                    <button onClick={fcl.unauthenticate}>Log Out</button>
                </div>
                :
                <div>
                    <button onClick={fcl.logIn}>Log In</button>
                    <button onClick={fcl.signUp}>Sign Up</button>
                </div>
            }
        </div>
    )
}