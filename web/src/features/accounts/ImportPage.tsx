import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { CopyButton } from '@/components/ui/copy-button'
import { Field } from '@/components/ui/field'
import { Input, Textarea } from '@/components/ui/input'
import { PageHeader, Section } from '@/components/ui/page'
import { Segmented } from '@/components/ui/segmented'
import { ErrorState, Loading } from '@/components/ui/states'
import { toast } from '@/components/ui/toast'
import { importMessages } from '@/features/accounts/messages'
import { accountsKey } from '@/features/accounts/queries'
import type { BrowserProfiles, BrowserType, PairingToken } from '@/features/accounts/types'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { fill, useI18n, useMessages } from '@/lib/i18n'

// BrowserImport 是从本机浏览器（Chrome、Brave、Edge、Firefox）导入
function BrowserImport() {
  const m = useMessages(importMessages)
  const client = useQueryClient()
  const [browser, setBrowser] = useState<BrowserType>('chrome')
  const [selected, setSelected] = useState<string[]>([])
  const [proxy, setProxy] = useState('')

  const browserOptions: { value: BrowserType; label: string }[] = [
    { value: 'chrome', label: m.sourceChrome },
    { value: 'brave', label: m.sourceBrave },
    { value: 'edge', label: m.sourceEdge },
    { value: 'firefox', label: m.sourceFirefox },
  ]

  const profiles = useQuery({
    queryKey: ['browser-profiles', browser],
    queryFn: () => api<BrowserProfiles>(`/api/accounts/import/browser?browser=${browser}`),
  })
  const run = useMutation({
    mutationFn: () =>
      api('/api/accounts/import/browser', {
        method: 'POST',
        json: { browser, targets: selected, emails: selected, proxy },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: accountsKey })
      void profiles.refetch()
      toast({ tone: 'success', title: m.importDone })
      setSelected([])
    },
    onError: (error) => {
      toast({ tone: 'error', title: error.message })
    },
  })
  const toggle = (target: string) => {
    setSelected((current) =>
      current.includes(target) ? current.filter((item) => item !== target) : [...current, target],
    )
  }
  const items = profiles.data?.profiles ?? []
  return (
    <Section title={m.browserTitle} description={m.browserHint}>
      <div className="flex flex-col gap-4">
        <Segmented
          label={m.browserTitle}
          value={browser}
          onValueChange={(val) => {
            setBrowser(val)
            setSelected([])
          }}
          options={browserOptions}
        />
        {profiles.isPending ? (
          <Loading label={m.browserTitle} />
        ) : profiles.isError ? (
          <ErrorState
            title={m.browserTitle}
            error={profiles.error}
            retryLabel={m.browserTitle}
            onRetry={() => void profiles.refetch()}
          />
        ) : items.length === 0 ? (
          <p className="text-sm text-foreground-muted">{m.noProfiles}</p>
        ) : (
          <ul className="-mx-5 -mt-2 flex flex-col divide-y divide-border border-b border-border">
            {items.map((profile) => {
              const target = profile.email || profile.profile
              return (
                <li key={`${profile.profile}/${profile.email}/${profile.auth_user ?? 0}`}>
                  <label className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-hover has-disabled:cursor-default has-disabled:opacity-70">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.includes(target)}
                      disabled={profile.imported || !profile.importable}
                      onChange={() => {
                        toggle(target)
                      }}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className="truncate text-base font-medium"
                        title={profile.email || profile.display_name || profile.profile}
                      >
                        {profile.email || profile.display_name || profile.profile}
                      </span>
                      <span
                        className="truncate text-xs text-foreground-muted"
                        title={[
                          profile.display_name,
                          profile.profile,
                          profile.auth_user !== undefined ? `${m.authUser} /u/${profile.auth_user}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      >
                        {[
                          profile.display_name,
                          profile.profile,
                          profile.auth_user !== undefined ? `${m.authUser} /u/${profile.auth_user}` : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {profile.imported ? (
                      <Badge tone="neutral">{m.imported}</Badge>
                    ) : !profile.importable ? (
                      <Badge tone="warning">
                        {profile.reason === 'read_failed'
                          ? m.readFailed
                          : profile.reason === 'needs_reauth'
                            ? m.needsReauth
                            : profile.reason === 'browser_running'
                              ? m.browserRunning
                              : m.notSignedIn}
                      </Badge>
                    ) : null}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        <Field id="browser-proxy" label={m.proxy} description={m.proxyHint}>
          <Input
            id="browser-proxy"
            value={proxy}
            placeholder="http://127.0.0.1:7890"
            onChange={(event) => {
              setProxy(event.target.value)
            }}
          />
        </Field>
        <div>
          <Button
            disabled={selected.length === 0}
            loading={run.isPending}
            onClick={() => {
              run.mutate()
            }}
          >
            {m.importSelected}
          </Button>
        </div>
      </div>
    </Section>
  )
}

// CookieImport 是从 Cookie 导入
function CookieImport() {
  const m = useMessages(importMessages)
  const client = useQueryClient()
  const [id, setId] = useState('')
  const [cookies, setCookies] = useState('')
  const [authUser, setAuthUser] = useState('0')
  const [proxy, setProxy] = useState('')
  const run = useMutation({
    mutationFn: () =>
      api('/api/accounts/import/cookie', {
        method: 'POST',
        json: { id, cookies, proxy, authuser: Number(authUser) },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: accountsKey })
      toast({ tone: 'success', title: m.importDone })
      setCookies('')
    },
    onError: (error) => {
      toast({ tone: 'error', title: error.message })
    },
  })
  return (
    <Section title={m.cookieTitle} description={m.cookieHint}>
      <Field id="cookie-id" label={m.cookieId} description={m.cookieIdHint}>
        <Input
          id="cookie-id"
          value={id}
          placeholder="name@gmail.com"
          onChange={(event) => {
            setId(event.target.value)
          }}
        />
      </Field>
      <Field id="cookie-value" label={m.cookieValue}>
        <Textarea
          id="cookie-value"
          rows={5}
          value={cookies}
          onChange={(event) => {
            setCookies(event.target.value)
          }}
        />
      </Field>
      <Field id="cookie-authuser" label={m.authUser} description={m.authUserHint}>
        <Input
          id="cookie-authuser"
          type="number"
          min={0}
          step={1}
          value={authUser}
          onChange={(event) => {
            setAuthUser(event.target.value)
          }}
        />
      </Field>
      <Field id="cookie-proxy" label={m.proxy} description={m.proxyHint}>
        <Input
          id="cookie-proxy"
          value={proxy}
          placeholder="http://127.0.0.1:7890"
          onChange={(event) => {
            setProxy(event.target.value)
          }}
        />
      </Field>
      <div>
        <Button
          disabled={!id.trim() || !cookies.trim() || !/^\d+$/.test(authUser)}
          loading={run.isPending}
          onClick={() => {
            run.mutate()
          }}
        >
          {m.importCookie}
        </Button>
      </div>
    </Section>
  )
}

// pairingCommand 是在登录了 Chrome 的电脑上上传账号的命令
const pairingCommand =
  (navigator.userAgent.includes('Windows') ? '.\\gemini-web2api.exe' : './gemini-web2api') +
  ' setup --remote ' +
  window.location.origin

// pairingInsecure 表示当前页面经 HTTP 访问非本机地址，setup --remote 不接受这种地址
const pairingInsecure =
  window.location.protocol !== 'https:' &&
  !['localhost', '[::1]'].includes(window.location.hostname) &&
  !/^127\.\d+\.\d+\.\d+$/.test(window.location.hostname)

// RemotePairing 生成配对令牌并给出 setup --remote 命令
function RemotePairing() {
  const m = useMessages(importMessages)
  const { locale } = useI18n()
  const create = useMutation({
    mutationFn: () => api<PairingToken>('/api/pairing', { method: 'POST' }),
    onError: (error) => {
      toast({ tone: 'error', title: error.message })
    },
  })
  const pairing = create.data
  return (
    <Section title={m.pairingTitle} description={m.pairingHint}>
      {pairingInsecure && <Callout tone="warning">{m.pairingInsecure}</Callout>}
      {pairing && (
        <div className="flex flex-col gap-3">
          {[
            { label: m.pairingCommand, value: pairingCommand },
            { label: m.pairingToken, value: pairing.token },
          ].map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-foreground-muted">{item.label}</span>
              <div className="flex items-center gap-2 rounded-md border border-border bg-surface py-[6px] pr-[6px] pl-3">
                <code className="min-w-0 flex-1 overflow-x-auto font-mono whitespace-nowrap select-all">
                  {item.value}
                </code>
                <CopyButton value={item.value} label={m.copy} copiedLabel={m.copied} />
              </div>
            </div>
          ))}
          <p className="text-xs text-foreground-muted">
            {fill(m.pairingExpires, {
              time: formatDateTime(new Date(pairing.expires_at), new Date(), locale),
            })}
          </p>
        </div>
      )}
      <div>
        <Button
          variant={pairing ? 'secondary' : 'primary'}
          loading={create.isPending}
          onClick={() => {
            create.mutate()
          }}
        >
          {m.createPairing}
        </Button>
      </div>
    </Section>
  )
}

// ImportPage 是导入账号页：浏览器（Chrome、Brave、Edge、Firefox）、Cookie 与远程配对三种来源
export function ImportPage() {
  const m = useMessages(importMessages)
  return (
    <>
      <PageHeader title={m.title} description={m.description} />
      <div className="flex w-full flex-col gap-3">
        <BrowserImport />
        <CookieImport />
        <RemotePairing />
      </div>
    </>
  )
}
