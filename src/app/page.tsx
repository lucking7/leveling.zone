'use client';

import { useState, useEffect, Suspense } from 'react';
import { useTheme } from "next-themes";
import { GradientText } from '@/components/ui/gradient-text';
import { LevelingLogo, LevelingLogoText } from '@/components/ui/logo';
import { Particles } from '@/components/ui/particles';
import { InteractiveHoverButton } from '@/components/ui/interactive-hover-button';
import { GlowingSearch } from '@/components/ui/glowing-search';
import { Search } from 'lucide-react';
import type { QueryResult } from '@/modules/query/types';

// The server validates complete IPv4/IPv6 syntax; do not reject compressed IPv6 here.
const isValidIP = (ip: string) => Boolean(ip.trim()) && /^[0-9a-fA-F:.]+$/.test(ip);

// 添加国旗转换函数
const countryToFlag = (countryCode: string) => {
  if (!/^[A-Za-z]{2}$/.test(countryCode)) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// 添加随机IP生成函数
const getRandomIP = () => ['1.1.1.1', '8.8.8.8', '9.9.9.9'][Math.floor(Math.random() * 3)];

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [showMenu, setShowMenu] = useState(false);
  const [ipAddress, setIpAddress] = useState('22.22.22.22');
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState('');
  const { theme } = useTheme();
  const [particleColor, setParticleColor] = useState("#ffffff");

  useEffect(() => {
    setParticleColor(theme === "dark" ? "#ffffff" : "#000000");
  }, [theme]);

  // 处理 URL 参数
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ipParam = params.get('ip');
    if (ipParam && isValidIP(ipParam)) {
      setIpAddress(ipParam);
    }
  }, []);

  // 验证输入的 IP
  useEffect(() => {
    if (ipAddress) {
      setIsValid(isValidIP(ipAddress));
    }
  }, [ipAddress]);

  const handleSearch = async (ip?: string) => {
    const targetIp = (ip || ipAddress).trim();
    if (!isValidIP(targetIp)) return;
    setIsLoading(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const response = await fetch(`/api/ip/${encodeURIComponent(targetIp)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '没有可用的查询结果，请稍后重试');
      setQueryResult(data);
      window.history.pushState({}, '', `/?ip=${encodeURIComponent(targetIp)}`);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : '查询失败');
    } finally { setIsLoading(false); }
  };

  // 只在按回车时触发查询
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValid) {
      handleSearch();
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: document.title,
        url: window.location.href
      });
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

  return (
    <main className="flex flex-col min-h-screen antialiased">
      {/* 顶部导航栏 */}
      <section className="pb-6">
        <nav className="container relative z-50 h-24 select-none">
          <div className="container relative flex flex-wrap items-center justify-between h-24 px-0 mx-auto overflow-hidden font-medium border-b border-gray-200 md:overflow-visible lg:justify-center sm:px-0">
            <div className="flex items-center justify-start w-1/4 h-full pr-4">
              <a href="/" className="flex items-center py-4 text-xl font-extrabold text-gray-900 md:py-0">
                <div className="flex items-center justify-center w-8 h-8 text-white bg-gray-900 rounded-full">
                  <div className="w-6 h-6 icon-[entypo--code]"></div>
                </div>
                <div className="ml-2">
                  LEVELING<span className="text-indigo-600">.</span>ZONE
                </div>
              </a>
            </div>
            <div className={`top-0 left-0 items-start ${showMenu ? 'flex fixed' : 'hidden'} w-full h-full p-4 text-sm bg-gray-900 bg-opacity-50 md:items-center md:w-3/4 md:absolute lg:text-base md:bg-transparent md:p-0 md:relative md:flex`}>
              <div className="flex-col w-full h-auto overflow-hidden bg-white rounded-lg md:bg-transparent md:overflow-visible md:rounded-none md:relative md:flex md:flex-row">
                <a href="/" className="inline-flex items-center block w-auto h-16 px-6 text-xl font-black leading-none text-gray-900 md:hidden">
                  <span className="flex items-center justify-center w-8 h-8 text-white bg-gray-900 rounded-full">
                    <span className="w-6 h-6 icon-[entypo--code]"></span>
                  </span>
                  <span className="mx-2">
                    LEVELING<span className="text-indigo-600">.</span>ZONE
                  </span>
                </a>
                <div className="w-full"></div>
                <div className="flex flex-col items-start justify-end w-full pt-4 md:items-center md:w-1/3 md:flex-row md:py-0">
                  <span 
                    onClick={handleShare} 
                    className="w-full px-6 py-2 mr-0 text-gray-700 cursor-pointer md:px-3 md:mr-2 lg:mr-3 md:w-auto"
                  >
                    分享
                  </span>
                  <a 
                    href="https://github.com/sponsors/jasper-zsh" 
                    target="_blank" 
                    className="inline-flex items-center w-full px-5 px-6 py-3 text-sm font-medium leading-4 text-white bg-gray-900 md:w-auto md:rounded-full hover:bg-gray-800 focus:outline-none md:focus:ring-2 focus:ring-0 focus:ring-offset-2 focus:ring-gray-800"
                  >
                    赞助
                  </a>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setShowMenu(!showMenu)} 
              className="absolute right-0 flex flex-col items-center items-end justify-center w-10 h-10 bg-white rounded-full cursor-pointer md:hidden hover:bg-gray-100"
            >
              {!showMenu ? (
                <span className="w-6 h-6 icon-[mdi--dots-horizontal]"></span>
              ) : (
                <span className="w-6 h-6 icon-[mdi--window-close]"></span>
              )}
            </button>
          </div>
        </nav>
      </section>

      <section className="flex flex-1">
        <div className="container mx-auto md:w-10/12">
          <div className="flex justify-center items-center relative bg-white bg-dot-black/[0.2] mb-6 flex-col">
            <div className="absolute pointer-events-none inset-0 flex items-center justify-center bg-white [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]"></div>
            <a className="py-12 font-sans text-5xl font-bold md:text-7xl lg:text-9xl">
              IP 位置查询
            </a>
            <div className="w-full flex justify-center pb-10">
              <a href="/myip" className="text-sm">
                <div 
                  className="relative"
                  onMouseEnter={() => {
                    const tooltip = document.getElementById('ip-tooltip');
                    if (tooltip) tooltip.style.display = 'block';
                  }}
                  onMouseLeave={() => {
                    const tooltip = document.getElementById('ip-tooltip');
                    if (tooltip) tooltip.style.display = 'none';
                  }}
                >
                  <div 
                    id="ip-tooltip" 
                    className="absolute w-auto text-sm top-0 left-1/2 -translate-x-1/2 -mt-0.5 -translate-y-full"
                    style={{ display: 'none' }}
                  >
                    <div className="relative px-2 py-1 text-white bg-black rounded bg-opacity-90">
                      <p className="flex-shrink-0 block text-xs whitespace-nowrap">点击此链接查看本机 IP</p>
                      <div className="absolute inline-flex items-center justify-center overflow-hidden bottom-0 -translate-x-1/2 left-1/2 w-2.5 translate-y-full">
                        <div className="w-1.5 h-1.5 transform bg-black bg-opacity-90 origin-top-left -rotate-45"></div>
                      </div>
                    </div>
                  </div>
                  <span className="px-3 py-1 text-xs rounded-full cursor-pointer text-neutral-500 bg-neutral-100 hover:bg-neutral-200 transition-colors duration-200">
                    想要查询本机 IP ?
                  </span>
                </div>
              </a>
            </div>
            
            {/* 搜索表单 */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch();
              }} 
              className="flex flex-col w-full mx-auto space-y-4 sm:space-x-2 sm:space-y-0 sm:flex-row md:w-2/3 mb-8 mt-2"
            >
              <div className="space-y-2 flex-1">
                <input
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  type="text"
                  placeholder="30.30.30.30"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-32"
              >
                {isLoading ? '查询中...' : '查询'}
              </button>
            </form>
          </div>

          {queryError && <p role="alert" className="container mx-auto px-4 pb-6 text-red-600">{queryError}</p>}
          {queryResult?.status === 'partial' && <p role="status" className="container mx-auto px-4 pb-4 text-gray-500">部分数据源暂不可用，以下为已获得的结果。</p>}
          {/* 查询结果区域 */}
          {queryResult && (
            <div className="container mx-auto px-4 md:px-8 lg:px-16 xl:px-32 mb-32">
              <div className="w-full overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="py-3 pr-4 font-medium text-sm text-gray-500 w-[180px]">数据源</th>
                      <th className="py-3 px-4 font-medium text-sm text-gray-500 w-[140px]">IP</th>
                      <th className="py-3 px-4 font-medium text-sm text-gray-500 w-[250px]">运营商</th>
                      <th className="py-3 pl-4 font-medium text-sm text-gray-500">地址</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(queryResult.sources).map(([source, data]) => {
                      const network = [data.network.asn, data.network.organization || data.network.isp || data.network.handle].filter(Boolean).join(' | ');
                      const location = [data.location.country, data.location.region, data.location.city, data.location.district].filter(Boolean).join(' • ');
                      return (
                        <tr key={source} className="border-t border-gray-200 hover:bg-gray-50">
                          <td className="py-3 pr-4 text-sm text-gray-500">{data.label}</td>
                          <td className="py-3 px-4 text-sm">{queryResult.ip}</td>
                          <td className="py-3 px-4 text-sm text-gray-900">{network || '-'}</td>
                          <td className="py-3 pl-4 text-sm text-gray-900">{countryToFlag(data.location.countryCode || '')} {location || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 页脚 */}
      <section className="text-gray-700 md:pt-6">
        <div className="container flex flex-col items-center py-8 mx-auto gap-2 lg:gap-5 items-start sm:flex-row sm:items-start">
          <div className="flex flex-col items-center sm:items-start py-1">
            <a href="/" className="text-xl font-black leading-none text-gray-900 select-none logo">
              LEVELING<span className="text-indigo-600">.</span>ZONE
            </a>
            <a className="mt-4 text-sm text-gray-500 block" href="https://leveling.zone" target="_blank">
              &copy; 2025 Web is Cool, Web is Best.
            </a>
          </div>
          
          <div className="flex-1 sm:px-2 md:px-10 lg:px-20 xl:px-36 text-center sm:text-left">
            <div className="text-lg font-bold text-gray-900 mb-4 hidden sm:block">Products</div>
            <div className="grid grid-cols-2 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1">
              <a href="https://tempmail.best/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="TempMail.Best">TempMail.Best</a>
              <a href="https://sink.cool/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="Sink.Cool">Sink.Cool</a>
              <a href="https://dns.surf/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="DNS.Surf">DNS.Surf</a>
              <a href="https://loooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo.ong/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="L(O*62).ONG">L(O*62).ONG</a>
              <a href="https://www.beauty.codes/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="Beauty.Codes">Beauty.Codes</a>
              <a href="https://www.awesome-homelab.com/" className="text-xs lg:text-sm leading-6 text-gray-500 hover:text-gray-900" title="Awesome Homelab">Awesome Homelab</a>
            </div>
          </div>
          
          <div className="inline-flex justify-center gap-5 mt-4 sm:ml-auto sm:mt-0 sm:grid sm:gap-y-1 sm:grid-cols-3">
            <a href="mailto:leveling.zone@miantiao.me" title="Email" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Email</span>
              <span className="w-6 h-6 icon-[mdi--email]"></span>
            </a>
            <a href="https://t.me/levelingzone" target="_blank" title="Telegram" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Telegram</span>
              <span className="w-6 h-6 icon-[mdi--telegram]"></span>
            </a>
            <a href="https://mt.ci/" target="_blank" title="Blog" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Blog</span>
              <span className="w-6 h-6 icon-[mdi--blogger]"></span>
            </a>
            <a href="https://404.li/x" target="_blank" title="Twitter" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Twitter</span>
              <span className="w-6 h-6 icon-[mdi--twitter]"></span>
            </a>
            <a href="https://c.im/@mt" target="_blank" title="Mastodon" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">Mastodon</span>
              <span className="w-6 h-6 icon-[mdi--mastodon]"></span>
            </a>
            <a href="https://github.com/ccbikai" target="_blank" title="GitHub" className="text-gray-400 hover:text-gray-500">
              <span className="sr-only">GitHub</span>
              <span className="w-6 h-6 icon-[mdi--github]"></span>
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
