import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import AlertList from './views/AlertList.vue';
import AlertDetail from './views/AlertDetail.vue';
import SlaConfig from './views/SlaConfig.vue';
import IncidentList from './views/IncidentList.vue';
import IncidentDetail from './views/IncidentDetail.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: AlertList },
    { path: '/alert/:id', component: AlertDetail, props: true },
    { path: '/settings/sla', component: SlaConfig },
    { path: '/incidents', component: IncidentList },
    { path: '/incident/:id', component: IncidentDetail, props: true },
  ],
});

createApp(App).use(router).mount('#app');
