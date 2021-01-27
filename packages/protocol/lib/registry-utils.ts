export const celoRegistryAddress = '0x000000000000000000000000000000000000ce10'

export enum CeloContractName {
  Accounts = 'Accounts',
  Attestations = 'Attestations',
  BlockchainParameters = 'BlockchainParameters',
  DoubleSigningSlasher = 'DoubleSigningSlasher',
  DowntimeSlasher = 'DowntimeSlasher',
  Election = 'Election',
  EpochRewards = 'EpochRewards',
  Escrow = 'Escrow',
  Exchange = 'Exchange',
  FeeCurrencyWhitelist = 'FeeCurrencyWhitelist',
  Freezer = 'Freezer',
  GasPriceMinimum = 'GasPriceMinimum',
  GoldToken = 'GoldToken',
  Governance = 'Governance',
  GovernanceSlasher = 'GovernanceSlasher',
  GovernanceApproverMultiSig = 'GovernanceApproverMultiSig',
  LockedGold = 'LockedGold',
  Random = 'Random',
  Reserve = 'Reserve',
  ReserveSpenderMultiSig = 'ReserveSpenderMultiSig',
  SortedOracles = 'SortedOracles',
  StableToken = 'StableToken',
  TransferWhitelist = 'TransferWhitelist',
  Validators = 'Validators',
}

export const usesRegistry = [
  CeloContractName.Escrow,
  CeloContractName.Reserve,
  CeloContractName.StableToken,
]

export const hasEntryInRegistry: string[] = [
  CeloContractName.Accounts,
  CeloContractName.Attestations,
  CeloContractName.BlockchainParameters,
  CeloContractName.DoubleSigningSlasher,
  CeloContractName.DowntimeSlasher,
  CeloContractName.Election,
  CeloContractName.Escrow,
  CeloContractName.Exchange,
  CeloContractName.FeeCurrencyWhitelist,
  CeloContractName.Freezer,
  CeloContractName.GasPriceMinimum,
  CeloContractName.GoldToken,
  CeloContractName.GovernanceSlasher,
  CeloContractName.Random,
  CeloContractName.Reserve,
  CeloContractName.SortedOracles,
  CeloContractName.StableToken,
]
