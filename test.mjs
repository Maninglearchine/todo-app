import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_URL = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

let passed = 0;
let failed = 0;

function log(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ PASS  ${label}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

async function run() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();

  await page.goto(FILE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  console.log('\n=== 쇼핑 리스트 앱 자동 테스트 ===\n');

  console.log('[ 1 ] 초기 상태 확인');
  const emptyMsg = await page.locator('.empty').isVisible();
  log('빈 목록 메시지 표시', emptyMsg);
  const summaryInit = await page.locator('#summaryText').innerText();
  log('요약 텍스트 "항목 없음" 표시', summaryInit === '항목 없음', summaryInit);

  console.log('\n[ 2 ] 아이템 추가');
  const input = page.locator('#itemInput');
  await input.fill('사과');
  await page.locator('.btn-add').click();
  let count = await page.locator('.list li').count();
  log('버튼 클릭으로 "사과" 추가', count === 1, `항목 수: ${count}`);
  await input.fill('바나나');
  await input.press('Enter');
  count = await page.locator('.list li').count();
  log('Enter 키로 "바나나" 추가', count === 2, `항목 수: ${count}`);
  await input.fill('우유');
  await input.press('Enter');
  count = await page.locator('.list li').count();
  log('"우유" 추가 (총 3개)', count === 3, `항목 수: ${count}`);
  await input.fill('   ');
  await page.locator('.btn-add').click();
  count = await page.locator('.list li').count();
  log('빈 입력 무시 (항목 수 유지)', count === 3, `항목 수: ${count}`);
  const inputVal = await input.inputValue();
  log('추가 후 입력창 초기화', inputVal === '' || inputVal.trim() === '');
  const summaryAfterAdd = await page.locator('#summaryText').innerText();
  log('요약 "0 / 3 구매완료" 표시', summaryAfterAdd === '0 / 3 구매완료', summaryAfterAdd);

  console.log('\n[ 3 ] 체크(구매완료) 기능');
  const firstCheck = page.locator('.check-btn').first();
  await firstCheck.click();
  const firstLi = page.locator('.list li').first();
  const isChecked = await firstLi.evaluate(el => el.classList.contains('checked'));
  log('첫 번째 항목 체크 → checked 클래스 추가', isChecked);
  const isStrikethrough = await firstLi.locator('.item-text').evaluate(
    el => getComputedStyle(el).textDecoration.includes('line-through')
  );
  log('체크된 항목 취소선 표시', isStrikethrough);
  const summaryAfterCheck = await page.locator('#summaryText').innerText();
  log('요약 "1 / 3 구매완료" 표시', summaryAfterCheck === '1 / 3 구매완료', summaryAfterCheck);
  await firstCheck.click();
  const isUnchecked = await firstLi.evaluate(el => !el.classList.contains('checked'));
  log('다시 클릭하면 체크 해제', isUnchecked);
  const summaryAfterUncheck = await page.locator('#summaryText').innerText();
  log('요약 "0 / 3 구매완료" 복원', summaryAfterUncheck === '0 / 3 구매완료', summaryAfterUncheck);

  console.log('\n[ 4 ] 필터 기능');
  await page.locator('.check-btn').first().click();
  await page.locator('.filter-btn', { hasText: '미구매' }).click();
  const activeCount = await page.locator('.list li').count();
  log('미구매 필터 → 2개 표시', activeCount === 2, `표시 수: ${activeCount}`);
  await page.locator('.filter-btn', { hasText: '구매완료' }).click();
  const doneCount = await page.locator('.list li').count();
  log('구매완료 필터 → 1개 표시', doneCount === 1, `표시 수: ${doneCount}`);
  await page.locator('.filter-btn', { hasText: '전체' }).click();
  const allCount = await page.locator('.list li').count();
  log('전체 필터 → 3개 표시', allCount === 3, `표시 수: ${allCount}`);

  console.log('\n[ 5 ] 아이템 삭제');
  const deleteBtns = page.locator('.delete-btn');
  await deleteBtns.nth(1).click();
  count = await page.locator('.list li').count();
  log('두 번째 항목 삭제 → 2개 남음', count === 2, `항목 수: ${count}`);
  const summaryAfterDel = await page.locator('#summaryText').innerText();
  log('요약 "1 / 2 구매완료" 업데이트', summaryAfterDel === '1 / 2 구매완료', summaryAfterDel);

  console.log('\n[ 6 ] 완료 항목 일괄 삭제');
  await page.locator('.clear-btn').click();
  count = await page.locator('.list li').count();
  log('"완료 항목 삭제" → 미구매만 남음 (1개)', count === 1, `항목 수: ${count}`);
  const summaryAfterClear = await page.locator('#summaryText').innerText();
  log('요약 "0 / 1 구매완료" 업데이트', summaryAfterClear === '0 / 1 구매완료', summaryAfterClear);

  console.log('\n[ 7 ] 데이터 영속성 (새로고침 후 유지)');
  await page.reload();
  const countAfterReload = await page.locator('.list li').count();
  log('새로고침 후 데이터 유지', countAfterReload === 1, `항목 수: ${countAfterReload}`);

  console.log('\n[ 8 ] 마지막 항목 삭제');
  await page.locator('.delete-btn').first().click();
  const emptyAgain = await page.locator('.empty').isVisible();
  log('모든 항목 삭제 후 빈 메시지 표시', emptyAgain);

  console.log('\n' + '─'.repeat(40));
  console.log(`  총 테스트: ${passed + failed}개`);
  console.log(`  ✅ 성공: ${passed}개`);
  if (failed > 0) console.log(`  ❌ 실패: ${failed}개`);
  console.log('─'.repeat(40) + '\n');

  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => { console.error(err); process.exit(1); });