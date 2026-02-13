// ============================================================
// DATA.JS — All static data for US & UK identity generation
// Ported from the original us.js / uk.js Cloudflare Workers
// ============================================================

const DATA = {
  us: {
    states: [
      { full: "Alabama", abbr: "AL" }, { full: "Alaska", abbr: "AK" }, { full: "Arizona", abbr: "AZ" },
      { full: "Arkansas", abbr: "AR" }, { full: "California", abbr: "CA" }, { full: "Colorado", abbr: "CO" },
      { full: "Connecticut", abbr: "CT" }, { full: "Delaware", abbr: "DE" }, { full: "Florida", abbr: "FL" },
      { full: "Georgia", abbr: "GA" }, { full: "Hawaii", abbr: "HI" }, { full: "Idaho", abbr: "ID" },
      { full: "Illinois", abbr: "IL" }, { full: "Indiana", abbr: "IN" }, { full: "Iowa", abbr: "IA" },
      { full: "Kansas", abbr: "KS" }, { full: "Kentucky", abbr: "KY" }, { full: "Louisiana", abbr: "LA" },
      { full: "Maine", abbr: "ME" }, { full: "Maryland", abbr: "MD" }, { full: "Massachusetts", abbr: "MA" },
      { full: "Michigan", abbr: "MI" }, { full: "Minnesota", abbr: "MN" }, { full: "Mississippi", abbr: "MS" },
      { full: "Missouri", abbr: "MO" }, { full: "Montana", abbr: "MT" }, { full: "Nebraska", abbr: "NE" },
      { full: "Nevada", abbr: "NV" }, { full: "New Hampshire", abbr: "NH" }, { full: "New Jersey", abbr: "NJ" },
      { full: "New Mexico", abbr: "NM" }, { full: "New York", abbr: "NY" }, { full: "North Carolina", abbr: "NC" },
      { full: "North Dakota", abbr: "ND" }, { full: "Ohio", abbr: "OH" }, { full: "Oklahoma", abbr: "OK" },
      { full: "Oregon", abbr: "OR" }, { full: "Pennsylvania", abbr: "PA" }, { full: "Rhode Island", abbr: "RI" },
      { full: "South Carolina", abbr: "SC" }, { full: "South Dakota", abbr: "SD" }, { full: "Tennessee", abbr: "TN" },
      { full: "Texas", abbr: "TX" }, { full: "Utah", abbr: "UT" }, { full: "Vermont", abbr: "VT" },
      { full: "Virginia", abbr: "VA" }, { full: "Washington", abbr: "WA" }, { full: "West Virginia", abbr: "WV" },
      { full: "Wisconsin", abbr: "WI" }, { full: "Wyoming", abbr: "WY" }
    ],
    areaCodes: {
      "AL":["205","251","256","334","938"],"AK":["907"],"AZ":["480","520","602","623","928"],
      "AR":["479","501","870"],"CA":["209","213","310","323","408","415","510","530","559","619","626","650","714","805","818","858","916","949"],
      "CO":["303","719","720","970"],"CT":["203","475","860","959"],"DE":["302"],
      "FL":["239","305","321","352","407","561","727","786","813","850","904","941","954"],
      "GA":["229","404","470","478","678","706","770","912"],"HI":["808"],"ID":["208","986"],
      "IL":["217","312","331","618","630","708","773","815","847"],"IN":["219","260","317","574","765","812"],
      "IA":["319","515","563","641","712"],"KS":["316","620","785","913"],"KY":["270","502","606","859"],
      "LA":["225","318","337","504","985"],"ME":["207"],"MD":["240","301","410","443"],
      "MA":["339","413","508","617","781","978"],"MI":["231","248","313","517","586","616","734","810","989"],
      "MN":["218","320","507","612","651","763","952"],"MS":["228","601","662","769"],
      "MO":["314","417","573","636","816"],"MT":["406"],"NE":["308","402","531"],
      "NV":["702","725","775"],"NH":["603"],"NJ":["201","551","609","732","856","908","973"],
      "NM":["505","575"],"NY":["212","315","347","516","518","585","607","631","646","716","718","845","914","917"],
      "NC":["252","336","704","828","910","919","984"],"ND":["701"],
      "OH":["216","234","330","419","440","513","614","740","937"],"OK":["405","539","580","918"],
      "OR":["458","503","541","971"],"PA":["215","267","412","484","570","610","717","724","814"],
      "RI":["401"],"SC":["803","843","864"],"SD":["605"],
      "TN":["423","615","731","865","901","931"],
      "TX":["210","214","254","281","325","409","469","512","682","713","806","817","832","903","915","936","956","972"],
      "UT":["385","435","801"],"VT":["802"],"VA":["276","434","540","571","703","757","804"],
      "WA":["206","253","360","425","509"],"WV":["304","681"],"WI":["262","414","608","715","920"],"WY":["307"]
    },
    cities: {
      "AL":["Birmingham","Montgomery","Huntsville","Mobile","Tuscaloosa"],
      "AK":["Anchorage","Fairbanks","Juneau"],
      "AZ":["Phoenix","Tucson","Mesa","Scottsdale","Tempe"],
      "AR":["Little Rock","Fort Smith","Fayetteville"],
      "CA":["Los Angeles","San Francisco","San Diego","Sacramento","San Jose","Oakland","Fresno","Long Beach"],
      "CO":["Denver","Colorado Springs","Boulder","Aurora","Fort Collins"],
      "CT":["Hartford","New Haven","Stamford","Bridgeport"],
      "DE":["Wilmington","Dover","Newark"],
      "FL":["Miami","Orlando","Tampa","Jacksonville","Fort Lauderdale","St. Petersburg"],
      "GA":["Atlanta","Savannah","Augusta","Athens","Macon"],
      "HI":["Honolulu","Hilo","Kailua"],
      "ID":["Boise","Nampa","Meridian","Idaho Falls"],
      "IL":["Chicago","Springfield","Naperville","Rockford","Peoria"],
      "IN":["Indianapolis","Fort Wayne","Evansville","South Bend"],
      "IA":["Des Moines","Cedar Rapids","Davenport","Iowa City"],
      "KS":["Wichita","Overland Park","Kansas City","Topeka"],
      "KY":["Louisville","Lexington","Bowling Green","Frankfort"],
      "LA":["New Orleans","Baton Rouge","Shreveport","Lafayette"],
      "ME":["Portland","Augusta","Bangor"],
      "MD":["Baltimore","Annapolis","Rockville","Frederick"],
      "MA":["Boston","Cambridge","Worcester","Springfield"],
      "MI":["Detroit","Grand Rapids","Ann Arbor","Lansing"],
      "MN":["Minneapolis","St. Paul","Rochester","Duluth"],
      "MS":["Jackson","Gulfport","Hattiesburg","Biloxi"],
      "MO":["Kansas City","St. Louis","Springfield","Columbia"],
      "MT":["Billings","Missoula","Great Falls","Helena"],
      "NE":["Omaha","Lincoln","Bellevue"],
      "NV":["Las Vegas","Reno","Henderson","Sparks"],
      "NH":["Manchester","Nashua","Concord"],
      "NJ":["Newark","Jersey City","Trenton","Paterson","Elizabeth"],
      "NM":["Albuquerque","Santa Fe","Las Cruces"],
      "NY":["New York","Buffalo","Rochester","Albany","Syracuse"],
      "NC":["Charlotte","Raleigh","Durham","Greensboro","Winston-Salem"],
      "ND":["Fargo","Bismarck","Grand Forks","Minot"],
      "OH":["Columbus","Cleveland","Cincinnati","Dayton","Toledo"],
      "OK":["Oklahoma City","Tulsa","Norman","Broken Arrow"],
      "OR":["Portland","Eugene","Salem","Bend"],
      "PA":["Philadelphia","Pittsburgh","Allentown","Harrisburg","Erie"],
      "RI":["Providence","Warwick","Cranston"],
      "SC":["Charleston","Columbia","Greenville","Myrtle Beach"],
      "SD":["Sioux Falls","Rapid City","Aberdeen"],
      "TN":["Nashville","Memphis","Knoxville","Chattanooga"],
      "TX":["Houston","Dallas","Austin","San Antonio","Fort Worth","El Paso","Arlington"],
      "UT":["Salt Lake City","Provo","Ogden","St. George"],
      "VT":["Burlington","Montpelier","Rutland"],
      "VA":["Virginia Beach","Richmond","Norfolk","Arlington","Alexandria"],
      "WA":["Seattle","Tacoma","Spokane","Bellevue","Vancouver"],
      "WV":["Charleston","Huntington","Morgantown","Parkersburg"],
      "WI":["Milwaukee","Madison","Green Bay","Kenosha"],
      "WY":["Cheyenne","Casper","Laramie","Gillette"]
    },
    streets: [
      "Main St","Oak Ave","Elm St","Maple Dr","Cedar Ln","Pine St","Walnut St","Washington Blvd",
      "Park Ave","Lake Dr","Hill Rd","Sunset Blvd","River Rd","Forest Ave","Meadow Ln",
      "Spring St","Highland Ave","Church St","Academy Dr","Lincoln Ave","Jefferson St",
      "Franklin Blvd","Adams St","Madison Ave","Monroe Dr","Jackson Blvd","Harrison St",
      "Willow Way","Birch Ct","Aspen Trl","Cherry Ln","Dogwood Dr","Magnolia St",
      "Peachtree Rd","Lakeview Dr","Valley Rd","Summit Ave","Ridge Rd","Brookside Dr",
      "Country Club Rd","College Ave","University Dr","Market St","Commerce Blvd"
    ],
    firstNames: {
      male: ["James","John","Robert","Michael","David","William","Richard","Joseph","Thomas","Christopher",
             "Daniel","Matthew","Anthony","Mark","Steven","Andrew","Joshua","Kenneth","Kevin","Brian",
             "Edward","Ronald","Timothy","Jason","Jeffrey","Ryan","Jacob","Gary","Nicholas","Eric"],
      female: ["Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen",
               "Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna",
               "Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia"]
    },
    lastNames: ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez",
                "Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin",
                "Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson",
                "Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores"]
  },

  uk: {
    regions: ["England","Scotland","Wales","Northern Ireland"],
    postcodeAreas: {
      "England": ["B","BD","BH","BL","BN","BR","BS","CB","CH","CM","CO","CR","CT","CV","CW","DE","DH","DL","DN","DY","E","EC","EN","EX","FY","GL","GU","HA","HD","HG","HP","HR","HU","HX","IG","IP","KT","L","LA","LE","LS","LU","M","ME","MK","N","NE","NG","NN","NR","NW","OL","OX","PE","PO","PR","RG","RH","RM","S","SE","SG","SK","SL","SM","SN","SO","SP","SR","SS","ST","SW","SY","TA","TN","TW","UB","W","WA","WC","WD","WF","WN","WR","WS","WV","YO"],
      "Scotland": ["AB","DD","DG","EH","FK","G","HS","IV","KA","KW","KY","ML","PA","PH","TD","ZE"],
      "Wales": ["CF","LD","LL","NP","SA","SY"],
      "Northern Ireland": ["BT"]
    },
    landlineCodes: {
      "England": ["020","0121","0151","0161","0114","0117","0113","0115"],
      "Scotland": ["0131","0141","01224","01382"],
      "Wales": ["029","01792","01248"],
      "Northern Ireland": ["028","02890","02871"]
    },
    cities: {
      "England": ["London","Manchester","Birmingham","Liverpool","Leeds","Bristol","Sheffield","Newcastle","Nottingham","Leicester","Brighton","Oxford","Cambridge","York","Bath","Southampton","Portsmouth","Exeter","Norwich","Plymouth"],
      "Scotland": ["Edinburgh","Glasgow","Aberdeen","Dundee","Inverness","Stirling","Perth","St Andrews"],
      "Wales": ["Cardiff","Swansea","Newport","Bangor","Wrexham","Aberystwyth","Llandudno"],
      "Northern Ireland": ["Belfast","Derry","Lisburn","Newry","Bangor","Armagh","Omagh"]
    },
    streets: [
      "High Street","Church Road","Station Road","London Road","Park Road","Victoria Street",
      "Queen Street","King Street","Manor Road","The Avenue","Mill Lane","Green Lane",
      "Chapel Street","New Road","Bridge Street","Market Street","North Street","South Street",
      "West Street","East Street","George Street","York Road","Albert Road","Castle Street",
      "Springfield Road","Priory Road","Grange Road","Stanley Road","Richmond Road","Windsor Road"
    ],
    firstNames: {
      male: ["Oliver","George","Harry","Jack","Noah","Leo","Arthur","Muhammad","Oscar","Charlie",
             "James","Henry","William","Thomas","Alfie","Edward","Alexander","Ethan","Jacob","Daniel"],
      female: ["Olivia","Amelia","Isla","Ava","Emily","Sophia","Grace","Mia","Poppy","Ella",
               "Lily","Evie","Hannah","Charlotte","Jessica","Lucy","Daisy","Sophie","Ruby","Chloe"]
    },
    lastNames: ["Smith","Jones","Williams","Taylor","Brown","Davies","Evans","Wilson","Thomas","Roberts",
                "Johnson","Lewis","Walker","Robinson","Wood","Thompson","White","Watson","Jackson","Wright",
                "Green","Harris","Cooper","King","Lee","Martin","Clarke","James","Morgan","Hughes"]
  }
};
