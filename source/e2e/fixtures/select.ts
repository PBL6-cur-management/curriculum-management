import { expect, type Locator, type Page } from '@playwright/test';

interface ChooseOptionOptions {
  search?: string;
}

export async function chooseOption(
  page: Page,
  combobox: Locator,
  label: string,
  options: ChooseOptionOptions = {},
): Promise<void> {
  if ((await combobox.getAttribute('aria-expanded')) !== 'true') {
    await combobox.click();
  }
  if (options.search !== undefined) {
    await combobox.fill(options.search);
  }
  // AntD virtual Select options expose hidden ARIA nodes; click the titled item in the visible popup instead.
  const dropdown = page.locator('.ant-select-dropdown:visible');
  const option = dropdown.getByTitle(label, { exact: true });
  // The virtual list renders only the rows in view: with real data (dozens of units, hundreds of courses) the
  // option may sit below the fold, so a searchable select is narrowed to the label before clicking.
  if (
    options.search === undefined &&
    !(await option.isVisible().catch(() => false)) &&
    (await combobox.isEditable())
  ) {
    await combobox.fill(label);
  }
  await option.click();
  await expect(combobox).toHaveAttribute('aria-expanded', 'false');
  await expect(dropdown).toHaveCount(0);
}
