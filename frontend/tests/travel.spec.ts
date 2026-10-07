import {test,expect} from '@playwright/test';

test('real India and international city discovery, local trip and reload',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Make room for the journey.'})).toBeVisible();
  await page.getByLabel('Search destinations').fill('Madurai');
  await page.getByRole('button',{name:'Search cities',exact:true}).click();
  await expect(page.getByTestId('place-card').first()).toContainText('India');
  await page.getByTestId('place-card').first().getByRole('button',{name:'Add to trip'}).click();
  await expect(page.getByRole('heading',{name:'Your journey, your way.'})).toBeVisible();
  await page.getByLabel('Trip title').fill('Family journey');
  await page.getByRole('button',{name:'Keep draft on this device'}).click();
  await page.reload();
  await page.getByRole('button',{name:'My trips',exact:true}).click();
  await expect(page.getByText('Family journey',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Discover',exact:true}).click();
  await page.getByLabel('Search destinations').fill('Paris');
  await page.getByRole('button',{name:'Search cities',exact:true}).click();
  await expect(page.getByTestId('place-card').first()).toContainText('France');
  await expect(page.getByText('GeoNames · CC BY 4.0',{exact:false}).first()).toBeVisible();
});

test('empty search, provider configuration and unsupported translation are honest',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(globalThis,'Translator',{value:undefined,configurable:true}));
  await page.goto('/');
  await page.getByLabel('Search destinations').fill('unfindablecityxyz');
  await page.getByRole('button',{name:'Search cities',exact:true}).click();
  await expect(page.getByText('No destinations found.')).toBeVisible();
  await page.getByRole('button',{name:'Translator',exact:true}).click();
  await page.getByLabel('Text to translate').fill('Where is the station?');
  await page.getByRole('button',{name:'Translate',exact:true}).click();
  await expect(page.getByText('On-device translation is unavailable in this browser.',{exact:false})).toBeVisible();
});

test('mobile layout and map failure preserve accessible results',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/');
  await page.getByLabel('Search destinations').fill('மதுரை');
  await page.getByRole('button',{name:'Search cities',exact:true}).click();
  await expect(page.getByTestId('place-card').first()).toContainText('India');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByRole('button',{name:'தமிழ்',exact:true}).click();
  await expect(page.getByLabel('Search destinations')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
