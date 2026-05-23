<template>
  <div id="app">
    <header class="header">
      <div class="header-left">
        <h1><router-link to="/" class="brand">IncidentDesk</router-link></h1>
        <span class="subtitle">告警处置台</span>
      </div>
      <nav class="nav">
        <router-link to="/incidents" class="nav-link">事件</router-link>
        <router-link to="/settings/sla" class="nav-link">SLA配置</router-link>
      </nav>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f7fa;
  color: #333;
}
.header {
  background: #1a1a2e;
  color: #fff;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.header-left {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.header h1 {
  font-size: 20px;
  font-weight: 600;
}
.brand {
  color: #fff;
  text-decoration: none;
}
.subtitle {
  font-size: 14px;
  opacity: 0.7;
}
.nav {
  display: flex;
  gap: 16px;
}
.nav-link {
  color: rgba(255,255,255,0.8);
  text-decoration: none;
  font-size: 14px;
  padding: 4px 12px;
  border-radius: 4px;
  transition: background 0.2s;
}
.nav-link:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}
main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
</style>
