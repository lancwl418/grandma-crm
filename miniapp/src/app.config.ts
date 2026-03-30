export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/home/index',
    'pages/search/index',
    'pages/detail/index',
    'pages/profile/index',
    'pages/agent/index',
    'pages/agent/visitors/index',
    'pages/agent/clients/index',
    'pages/agent/client-detail/index',
    'pages/agent/search/index',
    'pages/agent/profile/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'Estate Epic',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#64748b',
    selectedColor: '#2563eb',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '首页',
        iconPath: 'assets/home.png',
        selectedIconPath: 'assets/home-active.png'
      },
      {
        pagePath: 'pages/search/index',
        text: '搜索',
        iconPath: 'assets/search.png',
        selectedIconPath: 'assets/search-active.png'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/user.png',
        selectedIconPath: 'assets/user-active.png'
      }
    ]
  }
})
