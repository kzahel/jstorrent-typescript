import descriptor from '../data/production-release.json'
import { selectProductionWebsiteRelease } from './production-release'

export const productionSiteRelease = selectProductionWebsiteRelease(descriptor)
export const sourceRepositoryUrl = productionSiteRelease
  ? 'https://github.com/kzahel/rstorrent'
  : 'https://github.com/kzahel/jstorrent'
