export default defineAppConfig({
  pages: [
    "pages/index/index",
    "pages/search/index",
    "pages/detail/index",
    "pages/profile/index",
  ],
  tabBar: {
    color: "#999",
    selectedColor: "#2563eb",
    backgroundColor: "#fff",
    borderStyle: "white",
    list: [
      { pagePath: "pages/index/index", text: "找房", iconPath: "assets/home.png", selectedIconPath: "assets/home-active.png" },
      { pagePath: "pages/profile/index", text: "我的", iconPath: "assets/user.png", selectedIconPath: "assets/user-active.png" },
    ],
  },
  window: {
    backgroundTextStyle: "light",
    navigationBarBackgroundColor: "#fff",
    navigationBarTitleText: "Estate Epic",
    navigationBarTextStyle: "black",
  },
});
