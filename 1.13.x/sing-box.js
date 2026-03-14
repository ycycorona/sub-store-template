const { type, name, ts_hostname, vps_ips } = $arguments
const compatible_outbound = {
  tag: 'COMPATIBLE',
  type: 'direct',
}

let compatible
let config = JSON.parse($files[0])
let proxies = await produceArtifact({
  name,
  type: /^1$|col/i.test(type) ? 'collection' : 'subscription',
  platform: 'sing-box',
  produceType: 'internal',
})

// 设置 Tailscale hostname（通过 Sub-Store 传参 ts_hostname 指定）
if (ts_hostname && Array.isArray(config.endpoints)) {
  config.endpoints.forEach(ep => {
    if (ep.type === 'tailscale') {
      ep.hostname = ts_hostname
    }
  })
}

// 动态处理 VPS IPs，保证隐私不写死在模版
if (vps_ips) {
  const customIps = vps_ips.split(',').map(ip => ip.trim() + (ip.includes('/') ? '' : '/32'))
  
  // 添加 VPS 分组
  config.outbounds.push({
    tag: 'vps',
    type: 'selector',
    outbounds: ['direct', 'proxy'],
    default: 'direct'
  })

  // 将 VPS 路由规则插到前面（通常插在 "ip_is_private" 规则前面或者第一个 clash_mode 之后）
  // 这里我们为了稳妥找下 "ip_is_private" 前的位置插入
  const insertIndex = config.route.rules.findIndex(r => r.ip_is_private === true)
  const vpsRule = {
    ip_cidr: customIps,
    action: 'route',
    outbound: 'vps'
  }
  
  if (insertIndex !== -1) {
    config.route.rules.splice(insertIndex, 0, vpsRule)
  } else {
    config.route.rules.unshift(vpsRule)
  }
}

config.outbounds.push(...proxies)

config.outbounds.map(i => {
  if (['all', 'all-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies))
  }
  if (['hk', 'hk-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /港|hk|hongkong|hong kong|🇭🇰/i))
  }
  if (['tw', 'tw-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /台|tw|taiwan|🇹🇼/i))
  }
  if (['jp', 'jp-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /日本|jp|japan|🇯🇵/i))
  }
  if (['sg', 'sg-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /^(?!.*(?:us)).*(新|sg|singapore|🇸🇬)/i))
  }
  if (['us', 'us-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /美|us|unitedstates|united states|🇺🇸/i))
  }
  if (['cn', 'cn-auto'].includes(i.tag)) {
    i.outbounds.push(...getTags(proxies, /中|回国|cn|china|🇨🇳/i))
  }
})

config.outbounds.forEach(outbound => {
  if (Array.isArray(outbound.outbounds) && outbound.outbounds.length === 0) {
    if (!compatible) {
      config.outbounds.push(compatible_outbound)
      compatible = true
    }
    outbound.outbounds.push(compatible_outbound.tag);
  }
});

$content = JSON.stringify(config, null, 2)

function getTags(proxies, regex) {
  return (regex ? proxies.filter(p => regex.test(p.tag)) : proxies).map(p => p.tag)
}
