import {
  Bip39,
  CELO_DERIVATION_PATH_BASE,
  MnemonicLanguages,
  MnemonicStrength,
  RandomNumberGenerator,
} from '@celo/base/lib/account'
import { normalizeAccents } from '@celo/base/lib/string'
import * as bip32 from 'bip32'
import * as bip39 from 'bip39'
import { keccak256 } from 'ethereumjs-util'
import randomBytes from 'randombytes'
import { privateKeyToAddress } from './address'
import { levenshteinDistance } from './levenshtein'
// Exports moved to @celo/base, forwarding them
// here for backwards compatibility
export {
  Bip39,
  CELO_DERIVATION_PATH_BASE,
  MnemonicLanguages,
  MnemonicStrength,
  RandomNumberGenerator,
} from '@celo/base/lib/account'

function defaultGenerateMnemonic(
  strength?: number,
  rng?: RandomNumberGenerator,
  wordlist?: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    strength = strength || 128
    rng = rng || randomBytes

    rng(strength / 8, (error, randomBytesBuffer) => {
      if (error) {
        reject(error)
      } else {
        resolve(bip39.entropyToMnemonic(randomBytesBuffer.toString('hex'), wordlist))
      }
    })
  })
}

const bip39Wrapper: Bip39 = {
  mnemonicToSeedSync: bip39.mnemonicToSeedSync,
  mnemonicToSeed: bip39.mnemonicToSeed,
  generateMnemonic: defaultGenerateMnemonic,
  validateMnemonic: bip39.validateMnemonic,
}

export async function generateMnemonic(
  strength: MnemonicStrength = MnemonicStrength.s256_24words,
  language?: MnemonicLanguages,
  bip39ToUse: Bip39 = bip39Wrapper
): Promise<string> {
  return bip39ToUse.generateMnemonic(strength, undefined, getWordList(language))
}

export function validateMnemonic(
  mnemonic: string,
  bip39ToUse: Bip39 = bip39Wrapper,
  language?: MnemonicLanguages
) {
  if (language !== undefined) {
    return bip39ToUse.validateMnemonic(mnemonic, getWordList(language))
  }

  const languages = getAllLanguages()
  for (const language of languages) {
    if (bip39ToUse.validateMnemonic(mnemonic, getWordList(language))) {
      return true
    }
  }

  return false
}

/**
 * Normalize the mnemonic phrase to eliminate a number of inconsistencies with standard BIP-39
 * phrases that are likely to arise when a user manually enters a phrase.
 *
 * @remarks Note that this does not guarantee that the output is a valid mnemonic phrase, or even
 * that all the words in the phrase are contained in a valid wordlist.
 */
export function normalizeMnemonic(mnemonic: string, language?: MnemonicLanguages): string {
  const words = splitMnemonic(mnemonic)
  const lowered = words.map((word) => word.toLowerCase())
  const detectedLanguage = language ?? detectLanguage(lowered)

  // If the language is unknown, do not run further normalizations.
  if (detectedLanguage === undefined) {
    return joinMnemonic(lowered, detectedLanguage)
  }

  return joinMnemonic(formatNonAccentedCharacters(lowered, detectedLanguage), detectedLanguage)
}

/**
 * Scans the provided phrase and adds accents to words where the are not provided, or provided
 * inconsistently with the BIP-39 standard. Ensures that phrases differing only by accents will
 * validate after being cast into the normalized form.
 *
 * @remarks Words should be converted to lower case before being given to this function.
 */
function formatNonAccentedCharacters(words: string[], language: MnemonicLanguages): string[] {
  if (isLatinBasedLanguage(language)) {
    const wordList = getWordList(language)
    const normalizedWordMap = new Map(wordList.map((word) => [normalizeAccents(word), word]))
    return words.map((word) => normalizedWordMap.get(normalizeAccents(word)) ?? word)
  }

  return words
}

function isLatinBasedLanguage(language: MnemonicLanguages): boolean {
  // Use exhaustive switch to ensure that every language is accounted for.
  switch (language) {
    case MnemonicLanguages.english:
    case MnemonicLanguages.french:
    case MnemonicLanguages.italian:
    case MnemonicLanguages.spanish:
    case MnemonicLanguages.portuguese:
      return true
    case MnemonicLanguages.chinese_simplified:
    case MnemonicLanguages.chinese_traditional:
    case MnemonicLanguages.japanese:
    case MnemonicLanguages.korean:
      return false
  }
}

// Unify the bip39.wordlists (otherwise depends on the instance of the bip39)
function getWordList(language?: MnemonicLanguages): string[] {
  // Use exhaustive switch to ensure that every language is accounted for.
  switch (language ?? MnemonicLanguages.english) {
    case MnemonicLanguages.chinese_simplified:
      return bip39.wordlists.chinese_simplified
    case MnemonicLanguages.chinese_traditional:
      return bip39.wordlists.chinese_traditional
    case MnemonicLanguages.english:
      return bip39.wordlists.english
    case MnemonicLanguages.french:
      return bip39.wordlists.french
    case MnemonicLanguages.italian:
      return bip39.wordlists.italian
    case MnemonicLanguages.japanese:
      return bip39.wordlists.japanese
    case MnemonicLanguages.korean:
      return bip39.wordlists.korean
    case MnemonicLanguages.spanish:
      return bip39.wordlists.spanish
    case MnemonicLanguages.portuguese:
      return bip39.wordlists.portuguese
  }
}

export function getAllLanguages(): MnemonicLanguages[] {
  return [
    MnemonicLanguages.chinese_simplified,
    MnemonicLanguages.chinese_traditional,
    MnemonicLanguages.english,
    MnemonicLanguages.french,
    MnemonicLanguages.italian,
    MnemonicLanguages.japanese,
    MnemonicLanguages.korean,
    MnemonicLanguages.spanish,
    MnemonicLanguages.portuguese,
  ]
}

/**
 * Splits a mnemonic phrase into words, handling extra whitespace anywhere in the phrase.
 */
function splitMnemonic(mnemonic: string): string[] {
  return [...mnemonic.trim().split(/\s+/)]
}

/**
 * Joins a list of words into a mnemonic phrase. Inverse of splitMnemonic.
 */
function joinMnemonic(words: string[], language: MnemonicLanguages | undefined): string {
  return words.join(language === MnemonicLanguages.japanese ? '\u3000' : ' ')
}

/**
 * Detects the language of tokenized mnemonic phrase by applying a heuristic.
 *
 * @remarks Uses a heuristic of returning the language with the most matching words. In practice, we
 * expect all words to come from a single language, also some may be misspelled or otherwise
 * malformed. It may occasionally occur that a typo results in word from another language (e.g. bag
 * -> bagr) but this should occur at most once or twice per phrase.
 */
export function detectLanguage(
  words: string[],
  candidates?: MnemonicLanguages[]
): MnemonicLanguages | undefined {
  // Assign a match score to each language by how many words of the phrase are in each language.
  const scores: [MnemonicLanguages, number][] = (candidates ?? getAllLanguages()).map(
    (candidate) => {
      const wordSet = new Set(getWordList(candidate))
      const score = words.reduce((count, word) => (wordSet.has(word) ? count + 1 : count), 0)
      return [candidate, score]
    }
  )

  // Reduce to the highest scoring candidate(s). Note that it is possible for multiple candidates to
  // have the same score, but it likely to occur only for specially constructed phrases.
  const [winners, highscore] = scores.reduce(
    ([leaders, leadingScore], [candidate, score]) => {
      if (score > leadingScore) {
        return [[candidate], score]
      } else if (score === leadingScore) {
        return [[...leaders, candidate], leadingScore]
      }
      return [leaders, leadingScore]
    },
    [[], 0] as [MnemonicLanguages[], number]
  )

  if (winners.length !== 1 || highscore < 1) {
    return undefined
  }
  return winners[0]
}

/**
 * Generates a list of suggested corrections to the mnemonic phrase based on a set of heuristics.
 *
 * @remarks It is recommended to normalize the mnemonic phrase before inputting to this function.
 * DO NOT MERGE: Find a better name for this function... and break it up.
 */
function* suggestUnvalidatedCorrections(
  words: string[],
  language: MnemonicLanguages
): Generator<string> {
  // Identify locations with invalid words. We will attempt to correct each of these.
  // const validWords = new Set(getWordList(language))
  const invalidWords: { word: string; index: number }[] = words.map((word, index) => ({
    word,
    index,
  }))
  // DO NOT MERGE: Delete this line of change invalidWords.
  // .filter(({ word }) => !validWords.has(word))

  // If no words are invalid, no suggestions can be given.
  if (invalidWords.length === 0) {
    return
  }

  // DO NOT MERGE: Should I remove the index value here and optimize for always checking every work.
  const spotSuggestions: SpotSuggestions = new Map(
    invalidWords.map(({ word, index }) => [index, wordSuggestions(word, language)])
  )

  // DO NOT MERGE: Description and signature
  function* combineSuggestions(
    spots: SpotSuggestions,
    minWeight: number = 0,
    maxWeight: number = Infinity
  ): Generator<[number, string][], void, undefined> {
    const next = spots.entries().next()
    if (next.value === undefined || minWeight < 0 || maxWeight < 0) {
      throw Error('programming error: suggestions map must have at least one entry')
    }
    const [index, suggestions]: [number, SuggestionsByDistance] = next.value

    // Define a generator to iterate over the sorted list of suggestions, returning only the only
    // the ones that are within the specified weight range.
    function* suggestionsInRange(): Generator<Suggestion, undefined, undefined> {
      // Skip over any suggestions that are below the weight range min.
      let i = 0
      for (; i < suggestions.length; i++) {
        if (suggestions[i].distance >= minWeight) {
          break
        }
      }

      // Yield suggestions from the list until we've iterated past the set in the weight range.
      for (; i < suggestions.length; i++) {
        if (suggestions[i].distance >= maxWeight) {
          break
        }
        yield suggestions[i]
      }
      return
    }

    // Base case: TODO
    if (spots.size === 1) {
      for (const suggestion of suggestionsInRange()) {
        yield [[index, suggestion.word]]
      }
      return
    }

    // Recursion case: TODO
    const remaining: SpotSuggestions = new Map([...spots].filter(([i]) => i !== index))
    const suggestionsIterator = suggestionsInRange()
    let nextSuggestion: Suggestion | undefined = suggestionsIterator.next().value
    while (nextSuggestion !== undefined) {
      const suggestion = nextSuggestion
      nextSuggestion = suggestionsIterator.next().value

      for (const list of combineSuggestions(
        remaining,
        undefined,
        (nextSuggestion?.distance ?? maxWeight) - suggestion.distance
      )) {
        yield [[index, suggestion.word] as [number, string], ...list]
      }
    }

    /*
    for (const distance of [...suggestions.keys()].sort()) {
      if (distance > weight) {
        break
      }
      for (const list of combineSuggestions(remaining, weight - distance)) {
        for (const suggestion of suggestions.get(distance) ?? []) {
          yield [[index, suggestion] as [number, string], ...list]
        }
      }
    }
    */
  }

  // DO NOT MERGE: Description and stopping condition
  for (const replacementList of combineSuggestions(spotSuggestions)) {
    // Extract from the spot suggestions lists a suggested replacements keyed by index.
    const replacements = new Map(replacementList)
    const suggestedWords = words.map((word, i) => replacements.get(i) ?? word)
    yield joinMnemonic(suggestedWords, language)
  }
}

// TODO(victor): Implement a heuristic to check for swapped words.
export function* suggestCorrections(
  mnemonic: string,
  language?: MnemonicLanguages
): Generator<string> {
  const words = splitMnemonic(mnemonic)
  const lang = language ?? detectLanguage(words)

  // If the language is not provided or detected, no suggestions can be given.
  if (lang === undefined) {
    return
  }

  for (const suggestion of suggestUnvalidatedCorrections(words, lang)) {
    if (validateMnemonic(suggestion, undefined, lang)) {
      yield suggestion
    }
  }
}

// SpotSuggestions is a number of suggestions keyed by phrase index.
type SpotSuggestions = Map<number, SuggestionsByDistance>

// Suggestions by distance is a list of suggestion words sorted by distance ascending.
type SuggestionsByDistance = Suggestion[]

interface Suggestion {
  distance: number
  word: string
}

// DO NOT MERGE: Refactor this signature.
function wordSuggestions(typo: string, language: MnemonicLanguages): SuggestionsByDistance {
  return getWordList(language)
    .map((word) => ({ distance: levenshteinDistance(typo, word), word }))
    .sort((a, b) => a.distance - b.distance)
}

export async function generateKeys(
  mnemonic: string,
  password?: string,
  changeIndex: number = 0,
  addressIndex: number = 0,
  bip39ToUse: Bip39 = bip39Wrapper,
  derivationPath: string = CELO_DERIVATION_PATH_BASE
): Promise<{ privateKey: string; publicKey: string; address: string }> {
  const seed: Buffer = await generateSeed(mnemonic, password, bip39ToUse)
  return generateKeysFromSeed(seed, changeIndex, addressIndex, derivationPath)
}

export function generateDeterministicInviteCode(
  recipientPhoneHash: string,
  recipientPepper: string,
  addressIndex: number = 0,
  changeIndex: number = 0,
  derivationPath: string = CELO_DERIVATION_PATH_BASE
): { privateKey: string; publicKey: string } {
  const seed = keccak256(recipientPhoneHash + recipientPepper) as Buffer
  return generateKeysFromSeed(seed, changeIndex, addressIndex, derivationPath)
}

// keyByteLength truncates the seed. *Avoid its use*
// It was added only because a backwards compatibility bug
export async function generateSeed(
  mnemonic: string,
  password?: string,
  bip39ToUse: Bip39 = bip39Wrapper,
  keyByteLength: number = 64
): Promise<Buffer> {
  let seed: Buffer = await bip39ToUse.mnemonicToSeed(mnemonic, password)
  if (keyByteLength > 0 && seed.byteLength > keyByteLength) {
    const bufAux = Buffer.allocUnsafe(keyByteLength)
    seed.copy(bufAux, 0, 0, keyByteLength)
    seed = bufAux
  }
  return seed
}

export function generateKeysFromSeed(
  seed: Buffer,
  changeIndex: number = 0,
  addressIndex: number = 0,
  derivationPath: string = CELO_DERIVATION_PATH_BASE
): { privateKey: string; publicKey: string; address: string } {
  const node = bip32.fromSeed(seed)
  const newNode = node.derivePath(`${derivationPath}/${changeIndex}/${addressIndex}`)
  if (!newNode.privateKey) {
    // As we are generating the node from a seed, the node will always have a private key and this would never happened
    throw new Error('utils-accounts@generateKeys: invalid node to derivate')
  }
  return {
    privateKey: newNode.privateKey.toString('hex'),
    publicKey: newNode.publicKey.toString('hex'),
    address: privateKeyToAddress(newNode.privateKey.toString('hex')),
  }
}

export const AccountUtils = {
  generateMnemonic,
  validateMnemonic,
  normalizeMnemonic,
  generateKeys,
  generateSeed,
  generateKeysFromSeed,
}
