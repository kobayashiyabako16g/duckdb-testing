import { createRemoteJWKSet, jwtVerify } from 'jose'
import { config } from './config.js'

export interface CFAccessClaims {
  sub: string
  email: string
  aud: string | string[]
  iss: string
  exp: number
  iat: number
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

function getJWKS(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    const certsUrl = `https://${config.cfTeamDomain}/cdn-cgi/access/certs`
    jwks = createRemoteJWKSet(new URL(certsUrl))
  }
  return jwks
}

export async function verifyCFAccessJWT(token: string): Promise<CFAccessClaims> {
  const { payload } = await jwtVerify(token, getJWKS(), {
    audience: config.cfAud,
    algorithms: ['RS256'],
  })

  if (!payload.email || typeof payload.email !== 'string') {
    throw new Error('JWT payload missing email claim')
  }

  return payload as unknown as CFAccessClaims
}
