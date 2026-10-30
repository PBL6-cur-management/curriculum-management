// Token cho ConfigProvider — nguồn duy nhất cho màu, chữ, khoảng cách, motion của app.
// Giá trị lấy từ `tokens.ts` (nhận diện hệ thống chuẩn đầu ra của Trường).

import type { ThemeConfig } from 'antd';
import { fontStack, monoStack, palette, radius } from './tokens';

export const appTheme: ThemeConfig = {
  cssVar: { prefix: 'ctdt' },
  hashed: false,
  token: {
    colorPrimary: palette.brand,
    colorInfo: palette.info,
    colorSuccess: palette.pass,
    colorWarning: palette.warn,
    colorError: palette.fail,
    colorLink: palette.brand,
    colorLinkHover: palette.brandStrong,

    colorTextBase: palette.slate800,
    colorText: palette.slate800,
    colorTextSecondary: palette.slate500,
    colorTextTertiary: palette.slate400,
    colorTextHeading: palette.slate800,
    colorBorder: palette.slate300,
    colorBorderSecondary: palette.slate200,
    colorSplit: palette.slate200,
    colorFillSecondary: palette.slate100,
    colorFillTertiary: palette.slate50,
    colorBgLayout: palette.slate50,
    colorBgContainer: palette.white,
    colorBgElevated: palette.white,

    fontFamily: fontStack,
    fontFamilyCode: monoStack,
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 18,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    fontWeightStrong: 600,
    lineHeight: 1.5,

    borderRadius: radius.lg,
    borderRadiusLG: radius.xl,
    borderRadiusSM: radius.md,
    borderRadiusXS: radius.sm,
    controlHeight: 36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    boxShadow:
      '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.06)',
    boxShadowSecondary:
      '0 10px 15px -3px rgba(15, 23, 42, 0.10), 0 4px 6px -4px rgba(15, 23, 42, 0.08)',

    // Motion: 150–200 ms, một easing duy nhất, theo hệ thống của Trường.
    motionDurationFast: '0.12s',
    motionDurationMid: '0.16s',
    motionDurationSlow: '0.2s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  components: {
    Layout: {
      headerBg: palette.headerFrom,
      headerHeight: 64,
      headerPadding: '0 24px',
      siderBg: palette.white,
      bodyBg: palette.slate50,
    },
    Menu: {
      itemBorderRadius: radius.lg,
      itemMarginInline: 8,
      itemHeight: 38,
      itemColor: palette.slate700,
      itemHoverBg: palette.slate100,
      itemSelectedBg: palette.brandSoft,
      itemSelectedColor: palette.brandStrong,
      subMenuItemBg: palette.white,
      groupTitleColor: palette.slate500,
      groupTitleFontSize: 12,
    },
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none' },
    Table: {
      headerBg: palette.slate50,
      headerColor: palette.slate600,
      headerSplitColor: 'transparent',
      rowHoverBg: palette.slate50,
      rowSelectedBg: palette.brandSoft,
      rowSelectedHoverBg: palette.brandSoft,
      borderColor: palette.slate200,
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
      cellFontSize: 14,
    },
    Card: {
      headerFontSize: 16,
      headerFontSizeSM: 14,
      paddingLG: 20,
    },
    Form: { labelColor: palette.slate700, itemMarginBottom: 16 },
    Tag: { defaultBg: palette.slate100, defaultColor: palette.slate700 },
    Tabs: { itemColor: palette.slate600, horizontalItemGutter: 24 },
    Segmented: { itemSelectedColor: palette.brandStrong },
    Typography: { titleMarginBottom: 0, titleMarginTop: 0 },
  },
};
