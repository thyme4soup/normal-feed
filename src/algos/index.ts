import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as whatsAlf from './whats-alf'
import * as normalsOnly from './normals-only'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  //[whatsAlf.shortname]: whatsAlf.handler,
  [normalsOnly.shortname]: normalsOnly.handler,
}

export default algos
