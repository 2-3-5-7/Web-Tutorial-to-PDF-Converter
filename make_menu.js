"use strict";

function make_menu(container, menu, selectors, depth) {
  let [items_selector, item_title, item_url, item_action] = selectors[depth];

  for (let i of container.querySelectorAll(items_selector)) {
    let sub_menu = {
      title: i.querySelector(item_title).textContent,
      url: item_url ? i.querySelector(item_url).href : '#',
      items: [],
    };
    menu.push(sub_menu);

    if (depth + 1 !== selectors.length) {
      if (item_action === 'click')
        i.querySelector(item_url).click();
      make_menu(i, sub_menu.items, selectors, depth + 1);
    }
  }
}

function show_menu(menu, level) {
  console.log('\t'.repeat(level) + menu.url + '\t' + menu.title);
  for (let i of menu.items)
    show_menu(i, level + 1);
}

function main() {
  let menu = {
    title: 'The Modern JavaScript Tutorial',
    url: 'https://javascript.info/',
    items: [] };
  // items_selector, item_title, item_url, item_action
  let selectors = [['div.tabs__content', 'h2']
    , ['.list__item', '.list__title a', '.list__title a']
    , ['.list-sub__item:not(:has(a.list-sub__more))', 'a', 'a']
  ];
  make_menu(document.querySelector('body'), menu.items, selectors, 0);
  show_menu(menu, 0);
}

main();
