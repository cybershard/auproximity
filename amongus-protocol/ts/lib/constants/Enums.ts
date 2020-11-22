export enum ColourID {
    Red = 0x00,
    Blue = 0x01,
    DarkGreen = 0x02,
    Pink = 0x03,
    Orange = 0x04,
    Yellow = 0x05,
    Black = 0x06,
    White = 0x07,
    Purple = 0x08,
    Brown = 0x09,
    Cyan = 0x0a,
    Lime = 0x0b
}

export const ColorID = ColourID;

export enum DisconnectID {
    None = 0x00,
    GameFull = 0x01,
    GameStarted = 0x02,
    GameNotFound = 0x03,
    IncorrectVersion = 0x05,
    Banned = 0x06,
    Kicked = 0x07,
    Custom = 0x08,
    InvalidName = 0x09,
    Hacking = 0x0a,
    Destroy = 0x10,
    Error = 0x11,
    IncorrectGame = 0x12,
    ServerRequest = 0x13,
    ServerFull = 0x14,
    FocusLostBackground = 0xcf,
    IntentionalLeaving = 0xd0,
    FocusLost = 0xd1,
    NewConnection = 0xd2
}

export enum DistanceID {
    Short = 0x00,
    Medium = 0x01,
    Long = 0x02
}

export enum TaskBarUpdate {
    Always = 0x00,
    InMeetings = 0x01,
    Never = 0x02
}

export enum MessageID {
    Data = 0x01,
    RPC = 0x02,
    Spawn = 0x04,
    Despawn = 0x05,
    SceneChange = 0x06,
    Ready = 0x07,
    ChangeSettings = 0x08
}

export enum HatID {
    NoHat = 0x00,
    Astronaut = 0x01,
    BaseballCap = 0x02,
    BrainSlug = 0x03,
    BushHat = 0x04,
    CaptainsHat = 0x05,
    DoubleTopHat = 0x06,
    Flowerpot = 0x07,
    Goggles = 0x08,
    HardHat = 0x09,
    Military = 0x0a,
    PaperHat = 0x0b,
    PartyHat = 0x0c,
    Police = 0x0d,
    Stethescope = 0x0e,
    TopHat = 0x0f,
    TowelWizard = 0x10,
    Ushanka = 0x11,
    Viking = 0x12,
    WallCap = 0x13,
    Snowman = 0x14,
    Reindeer = 0x15,
    Lights = 0x16,
    Santa = 0x17,
    Tree = 0x18,
    Present = 0x19,
    Candycanes = 0x1a,
    ElfHat = 0x1b,
    NewYears2018 = 0x1c,
    WhiteHat = 0x1d,
    Crown = 0x1e,
    Eyebrows = 0x1f,
    HaloHat = 0x20,
    HeroCap = 0x21,
    PipCap = 0x22,
    PlungerHat = 0x23,
    ScubaHat = 0x24,
    StickminHat = 0x25,
    StrawHat = 0x26,
    TenGallonHat = 0x27,
    ThirdEyeHat = 0x28,
    ToiletPaperHat = 0x29,
    Toppat = 0x2a,
    Fedora = 0x2b,
    Goggles_2 = 0x2c,
    Headphones = 0x2d,
    MaskHat = 0x2e,
    PaperMask = 0x2f,
    Security = 0x30,
    StrapHat = 0x31,
    Banana = 0x32,
    Beanie = 0x33,
    Bear = 0x34,
    Cheese = 0x35,
    Cherry = 0x36,
    Egg = 0x37,
    Fedora_2 = 0x38,
    Flamingo = 0x39,
    FlowerPin = 0x3a,
    Helmet = 0x3b,
    Plant = 0x3c,
    BatEyes = 0x3d,
    BatWings = 0x3e,
    Horns = 0x3f,
    Mohawk = 0x40,
    Pumpkin = 0x41,
    ScaryBag = 0x42,
    Witch = 0x43,
    Wolf = 0x44,
    Pirate = 0x45,
    Plague = 0x46,
    Machete = 0x47,
    Fred = 0x48,
    MinerCap = 0x49,
    WinterHat = 0x4a,
    Archae = 0x4b,
    Antenna = 0x4c,
    Balloon = 0x4d,
    BirdNest = 0x4e,
    BlackBelt = 0x4f,
    Caution = 0x50,
    Chef = 0x51,
    CopHat = 0x52,
    DoRag = 0x53,
    DumSticker = 0x54,
    Fez = 0x55,
    GeneralHat = 0x56,
    GreyThing = 0x57,
    HunterCap = 0x58,
    JungleHat = 0x59,
    MiniCrewmate = 0x5a,
    NinjaMask = 0x5b,
    RamHorns = 0x5c,
    Snowman_2 = 0x5d
}

export enum LanguageID {
    Any = 0x00,
    Other = 0x01,
    English = 0x100,
    Spanish = 0x02,
    Korean = 0x04,
    Russian = 0x08,
    Portuguese = 0x10,
    Arabic = 0x20,
    Filipino = 0x40,
    Polish = 0x80
}

export enum SystemType {
    Hallway = 0x00,
    Storage = 0x01,
    Cafeteria = 0x02,
    Reactor = 0x03,
    UpperEngine = 0x04,
    Navigations = 0x05,
    Administrator = 0x06,
    Electrical = 0x07,
    O2 = 0x08,
    Shields = 0x09,
    MedBay = 0x0a,
    Security = 0x0b,
    Weapons = 0x0c,
    LowerEngine = 0x0d,
    Communications = 0x0e,
    ShipTasks = 0x0f,
    Doors = 0x10,
    Sabotage = 0x11,
    Decontamination = 0x12,
    Launchpad = 0x13,
    LockerRoom = 0x14,
    Laboratory = 0x15,
    Balcony = 0x16,
    Office = 0x17,
    Greenhouse = 0x18,
    Dropship = 0x19,
    Decontamination2 = 0x1a,
    Outside = 0x1b,
    Specimens = 0x1c,
    BoilerRoom = 0x1d
}

export enum DeconState {
    Idle = 0x00,
    Enter = 0x01,
    Closed = 0x02,
    Exit = 0x04,
    HeadingUp = 0x08
}

export enum MapID {
    TheSkeld = 0x00,
    MiraHQ = 0x01,
    Polus = 0x02
}

export enum PacketID {
    Unreliable = 0x00,
    Reliable = 0x01,
    Hello = 0x08,
    Disconnect = 0x09,
    Acknowledge = 0x0a,
    Ping = 0x0c
}

export enum PayloadID {
    HostGame = 0x00,
    JoinGame = 0x01,
    StartGame = 0x02,
    RemoveGame = 0x03,
    RemovePlayer = 0x04,
    GameData = 0x05,
    GameDataTo = 0x06,
    JoinedGame = 0x07,
    EndGame = 0x08,
    GetGameList = 0x09,
    AlterGame = 0x0a,
    KickPlayer = 0x0b,
    WaitForHost = 0x0c,
    Redirect = 0x0d,
    MasterServerList = 0x0e,
    GetGameListV2 = 0x10
}

export enum RPCID {
    PlayAnimation = 0x00,
    CompleteTask = 0x01,
    SyncSettings = 0x02,
    SetInfected = 0x03,
    Exiled = 0x04,
    CheckName = 0x05,
    SetName = 0x06,
    CheckColour = 0x07,
    SetColour = 0x08,
    SetHat = 0x09,
    SetSkin = 0x0a,
    ReportDeadBody = 0x0b,
    MurderPlayer = 0x0c,
    SendChat = 0x0d,
    StartMeeting = 0x0e,
    SetScanner = 0x0f,
    SendChatNote = 0x10,
    SetPet = 0x11,
    SetStartCounter = 0x12,
    EnterVent = 0x13,
    ExitVent = 0x14,
    SnapTo = 0x15,
    Close = 0x16,
    VotingComplete = 0x17,
    CastVote = 0x18,
    ClearVote = 0x19,
    AddVote = 0x1a,
    CloseDoorsOfType = 0x1b,
    RepairSystem = 0x1c,
    SetTasks = 0x1d,
    UpdateGameData = 0x1e
}

export enum DataID {
    Movement = 0x06
}

export enum PetID {
    None = 0x00,
    Alien = 0x01,
    Crewmate = 0x02,
    Doggy = 0x03,
    Stickmin = 0x04,
    Hamster = 0x05,
    Robot = 0x06,
    UFO = 0x07,
    Ellie = 0x08,
    Squig = 0x09,
    Bedcrab = 0x0a
}

export enum SkinID {
    None = 0x00,
    Astro = 0x01,
    Capt = 0x02,
    Mech = 0x03,
    Military = 0x04,
    Police = 0x05,
    Science = 0x06,
    SuitB = 0x07,
    SuitW = 0x08,
    Wall = 0x09,
    Hazmat = 0x0a,
    Security = 0x0b,
    Tarmac = 0x0c,
    Miner = 0x0d,
    Winter = 0x0e,
    Archae = 0x0f
}

export enum SpawnID {
    ShipStatus = 0x00,
    MeetingHub = 0x01,
    LobbyBehaviour = 0x02,
    GameData = 0x03,
    Player = 0x04,
    HeadQuarters = 0x05,
    PlanetMap = 0x06,
    AprilShipStatus = 0x07
}

export enum SpawnFlag {
    None = 0x00,
    IsClient = 0x01
}

export enum TaskID {
    SubmitScan = 0x00,
    PrimeShields = 0x01,
    FuelEngines = 0x02,
    CharCourse = 0x03,
    StartReactor = 0x04,
    SwipeCard = 0x05,
    ClearAsteroids = 0x06,
    UploadData = 0x07,
    InspectSample = 0x08,
    EmptyChute = 0x09,
    EmptyGarbage = 0x0a,
    AlignEngineOutput = 0x0b,
    FixWiring = 0x0c,
    CalibrateDistributor = 0x0d,
    DivertPower = 0x0e,
    UnlockManifolds = 0x0f,
    ResetReactor = 0x10,
    FixLights = 0x11,
    CleanO2Filter = 0x12,
    FixCommucations = 0x13,
    RestoreOxygen = 0x14,
    StablizeSteering = 0x15,
    AssembleArtifact = 0x16,
    SortSamples = 0x17,
    MeasureWeather = 0x18,
    EnterIdCode = 0x19,
    BuyBerverage = 0x1a,
    ProcessData = 0x1b,
    RunDiagnostics = 0x1c,
    WaterPlants = 0x1d,
    MonitorOxygen = 0x1e,
    StoreArtifacts = 0x1f,
    FillCanisters = 0x20,
    ActivateWeatherNodes = 0x21,
    InsertKeys = 0x22,
    ResetSeismic = 0x23,
    ScanBoardingPass = 0x24,
    OpenWaterways = 0x25,
    ReplaceWaterJug = 0x26,
    RepairDrill = 0x27,
    AlignTelescope = 0x28,
    RecordTemperature = 0x29,
    RebootWifi = 0x2a
}

export enum GameEndReason {
    HumansByVote = 0x00,
    HumansByTask = 0x01,
    ImposterByVote = 0x02,
    ImposterByKill = 0x03,
    ImposterBySabotage = 0x04,
    ImposterDisconnect = 0x05,
    HumansDisconnect = 0x06
}

export enum AlterGameTag {
    ChangePrivacy = 0x01
}