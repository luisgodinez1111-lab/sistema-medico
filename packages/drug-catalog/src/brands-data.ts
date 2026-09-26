// Marcas comerciales frecuentes en México (curado a mano, FACTUAL: marca → principio activo → laboratorio). Es un
// subconjunto de lo más prescrito, NO el universo completo; el catálogo completo de COFEPRIS se ingiere aparte cuando se
// tenga el export (ver brands.ts / ingestión). La relación marca→principio activo es de dominio público y verificable; NO se
// inventan datos clínicos (la monografía viene del principio activo, en monographs.ts). Formato: `marca\tprincipio_activo\tlaboratorio`.
// laboratorio vacío = no confirmado (una marca puede tener varias presentaciones/titulares).
export const DRUG_BRANDS_TSV=`Tempra	paracetamol	Taisho
Tylenol	paracetamol	Janssen
Sinutab	paracetamol
Dolo-Neurobión	paracetamol	Procter & Gamble
Advil	ibuprofeno	Pfizer
Motrin	ibuprofeno	Pfizer
Actron	ibuprofeno	Bayer
Naxen	naproxeno	Roche
Flanax	naproxeno	Bayer
Aspirina	aspirina	Bayer
Voltaren	diclofenaco	Novartis
Cataflam	diclofenaco	Novartis
Dolo-Voltaren	diclofenaco	GSK
Celebrex	celecoxib	Viatris
Arcoxia	etoricoxib	Organon
Mobic	meloxicam	Boehringer Ingelheim
Toradol	ketorolaco
Buscapina	butilhioscina	Sanofi
Sensibit	loratadina	Liomont
Clarityne	loratadina	Bayer
Avapena	clorfenamina
Benadryl	difenhidramina	Johnson & Johnson
Aerius	desloratadina	Organon
Xyzal	levocetirizina
Zyrtec	cetirizina
Losacor	losartán	Landsteiner
Cozaar	losartán	Organon
Micardis	telmisartán	Boehringer Ingelheim
Diován	valsartán	Novartis
Norvas	amlodipino	Pfizer
Adalat	nifedipino	Bayer
Tenormin	atenolol
Concor	bisoprolol	Merck
Lopresor	metoprolol	Novartis
Inderalici	propranolol
Capoten	captopril
Renitec	enalapril	Organon
Zestril	lisinopril
Cardura	doxazosina	Pfizer
Lasix	furosemida	Sanofi
Aldactone	espironolactona	Pfizer
Lanoxin	digoxina
Glucophage	metformina	Merck
Dabex	metformina	Silanes
Amaryl	glimepirida	Sanofi
Januvia	sitagliptina	Organon
Galvus	vildagliptina	Novartis
Forxiga	dapagliflozina	AstraZeneca
Jardiance	empagliflozina	Boehringer Ingelheim
Lantus	insulina glargina	Sanofi
Levemir	insulina detemir	Novo Nordisk
NovoRapid	insulina aspart	Novo Nordisk
Humulin	insulina	Eli Lilly
Lipitor	atorvastatina	Viatris
Zocor	simvastatina	Organon
Crestor	rosuvastatina	AstraZeneca
Pravacol	pravastatina
Nexium	esomeprazol	AstraZeneca
Losec	omeprazol	AstraZeneca
Pantozol	pantoprazol	Takeda
Controloc	pantoprazol	Takeda
Melox	hidróxido de aluminio	Sanofi
Plasil	metoclopramida	Sanofi
Zofran	ondansetrón	Novartis
Motilium	domperidona
Dramamine	dimenhidrinato
Amoxil	amoxicilina	GSK
Augmentin	amoxicilina	GSK
Ciproxina	ciprofloxacino	Bayer
Avelox	moxifloxacino	Bayer
Tavanic	levofloxacino	Sanofi
Zithromax	azitromicina	Pfizer
Vibramicina	doxiciclina	Pfizer
Keflex	cefalexina
Bactrim	trimetoprima	Roche
Flagyl	metronidazol	Sanofi
Unasyn	ampicilina	Pfizer
Rocephin	ceftriaxona	Roche
Dalacin	clindamicina	Pfizer
Tramal	tramadol	Grünenthal
Tradol	tramadol
Neurontin	gabapentina	Pfizer
Lyrica	pregabalina	Pfizer
Rivotril	clonazepam	Roche
Tafil	alprazolam	Pfizer
Valium	diazepam	Roche
Ativan	lorazepam	Pfizer
Prozac	fluoxetina	Eli Lilly
Zoloft	sertralina	Pfizer
Paxil	paroxetina	GSK
Lexapro	escitalopram	Lundbeck
Cipralex	escitalopram	Lundbeck
Efexor	venlafaxina	Pfizer
Wellbutrin	bupropión	GSK
Seroquel	quetiapina	AstraZeneca
Risperdal	risperidona	Janssen
Zyprexa	olanzapina	Eli Lilly
Ventolin	salbutamol	GSK
Salbutamol	salbutamol
Symbicort	budesonida	AstraZeneca
Seretide	fluticasona	GSK
Singulair	montelukast	Organon
Mucosolvan	ambroxol	Sanofi
Eutirox	levotiroxina	Merck
Synthroid	levotiroxina	Abbott
Coumadin	warfarina	Bristol-Myers Squibb
Xarelto	rivaroxabán	Bayer
Eliquis	apixabán	Bristol-Myers Squibb
Pradaxa	dabigatrán	Boehringer Ingelheim
Plavix	clopidogrel	Sanofi
Furadantina	nitrofurantoína
Canesten	clotrimazol	Bayer
Diflucan	fluconazol	Pfizer
Nizoral	ketoconazol	Janssen
Daktarin	miconazol	Janssen
Lamisil	terbinafina	Novartis
Zovirax	aciclovir	GSK
Prednisona	prednisona
Decadron	dexametasona
Celestone	betametasona	Organon
Redoxon	vitamina C	Bayer
Bedoyecta	complejo b	Grossman
Neurobión	complejo b	Procter & Gamble
Cytotec	misoprostol	Pfizer
Pepto-Bismol	subsalicilato de bismuto	Procter & Gamble
Dolac	ketorolaco	Siegfried Rhein
Supradol	ketorolaco	Senosiain
Ketesse	dexketoprofeno	Menarini
Feldene	piroxicam	Pfizer
Tandene	nimesulida
Prexige	lumiracoxib	Novartis
Pentrexyl	ampicilina	Bristol-Myers Squibb
Benzetacil	penicilina benzatínica	Teva
Zinnat	cefuroxima	GSK
Denvar	cefixima	Sanofi
Klaricid	claritromicina	Abbott
Elequine	levofloxacino	Sanofi
Noroxin	norfloxacino	Organon
Septrin	trimetoprima	GSK
Monurol	fosfomicina	Zambon
Macrodantina	nitrofurantoína	Teva
Inhibitron	omeprazol	Carnot
Zurcal	pantoprazol	Takeda
Ogastro	lansoprazol	Takeda
Pariet	rabeprazol	Janssen
Imodium	loperamida	Janssen
Salofalk	mesalazina	Dr. Falk
Allegra	fexofenadina	Sanofi
Kestine	ebastina	Almirall
Clorotrimeton	clorfenamina	Organon
Reactine	cetirizina	Johnson & Johnson
Aprovel	irbesartán	Sanofi
Atacand	candesartán	AstraZeneca
Olmetec	olmesartán	Menarini
Coversyl	perindopril	Servier
Tritace	ramipril	Sanofi
Glioten	enalapril	Senosiain
Betaloc	metoprolol	AstraZeneca
Dilatrend	carvedilol	Roche
Nebilet	nebivolol	Menarini
Coreg	carvedilol	GSK
Higrotona	clortalidona	Rhein
Isorbid	isosorbida	Rhein
Lipidil	fenofibrato	Abbott
Lopid	gemfibrozilo	Pfizer
Ezetrol	ezetimiba	Organon
Sintrom	acenocumarol	Merus
Daonil	glibenclamida	Sanofi
Euglucon	glibenclamida	Boehringer Ingelheim
Trayenta	linagliptina	Boehringer Ingelheim
Invokana	canagliflozina	Janssen
Actos	pioglitazona	Takeda
Apidra	insulina glulisina	Sanofi
Tresiba	insulina degludec	Novo Nordisk
Toujeo	insulina glargina	Sanofi
Victoza	liraglutida	Novo Nordisk
Saxenda	liraglutida	Novo Nordisk
Ozempic	semaglutida	Novo Nordisk
Trulicity	dulaglutida	Eli Lilly
Pulmicort	budesonida	AstraZeneca
Flixotide	fluticasona	GSK
Atrovent	ipratropio	Boehringer Ingelheim
Spiriva	tiotropio	Boehringer Ingelheim
Bisolvon	bromhexina	Sanofi
Altruline	sertralina	Pfizer
Seropram	citalopram	Lundbeck
Cymbalta	duloxetina	Eli Lilly
Remeron	mirtazapina	Organon
Lexotan	bromazepam	Roche
Stilnox	zolpidem	Sanofi
Abilify	aripiprazol	Otsuka
Haldol	haloperidol	Janssen
Carbolit	litio	Alpharma
Epival	divalproato	Abbott
Depakene	ácido valproico	Abbott
Tegretol	carbamazepina	Novartis
Lamictal	lamotrigina	GSK
Keppra	levetiracetam	UCB
Epamin	fenitoína	Pfizer
Topamax	topiramato	Janssen
Tirodril	tiamazol	Columbia
Valtrex	valaciclovir	GSK
Roaccutan	isotretinoína	Roche
Bactroban	mupirocina	GSK
Diprospan	betametasona	Organon
Zyloprim	alopurinol	Aspen
Calcort	deflazacort	Sanofi
Plaquenil	hidroxicloroquina	Sanofi
Viagra	sildenafil	Pfizer
Cialis	tadalafil	Eli Lilly
Levitra	vardenafil	Bayer
Secotex	tamsulosina	Boehringer Ingelheim
Proscar	finasterida	Organon
Propecia	finasterida	Organon
Avodart	dutasterida	GSK
Postday	levonorgestrel	Asofarma
Yasmin	drospirenona	Bayer
Microgynon	levonorgestrel	Bayer
Tobrex	tobramicina	Novartis
Ciloxan	ciprofloxacino	Novartis
Patanol	olopatadina	Novartis
Xalatan	latanoprost	Pfizer
Lumigan	bimatoprost	Abbvie
Alphagan	brimonidina	Abbvie
Combigan	brimonidina	Abbvie
Timoftol	timolol	Organon
Ambien	zolpidem	Sanofi
Nootropil	piracetam	UCB
Sifrol	pramipexol	Boehringer Ingelheim
Madopar	levodopa	Roche
Sinemet	levodopa	Organon
Exelon	rivastigmina	Novartis
Aricept	donepecilo	Pfizer
Ebixa	memantina	Lundbeck
Betaserc	betahistina	Abbott
Serc	betahistina	Abbott
Primperan	metoclopramida	Sanofi
Vermox	mebendazol	Janssen
Albendazol	albendazol	GSK
Zentel	albendazol	GSK
Flagystatin	metronidazol	Sanofi
Fasigyn	tinidazol	Pfizer
Nix	permetrina	GSK
Herklin	permetrina
Scabisan	permetrina	Chinoin
Advagraf	tacrolimus	Astellas
Prograf	tacrolimus	Astellas
Cellcept	micofenolato	Roche
Imuran	azatioprina	Aspen
Rapamune	sirolimus	Pfizer
Neoral	ciclosporina	Novartis
Enbrel	etanercept	Pfizer
Humira	adalimumab	Abbvie
Remicade	infliximab	Janssen
Mabthera	rituximab	Roche
Herceptin	trastuzumab	Roche
Glivec	imatinib	Novartis
Femara	letrozol	Novartis
Arimidex	anastrozol	AstraZeneca
Nolvadex	tamoxifeno	AstraZeneca
Casodex	bicalutamida	AstraZeneca
Zoladex	goserelina	AstraZeneca
Lupron	leuprorelina	Abbvie
Fosamax	alendronato	Organon
Actonel	risedronato	Sanofi
Bonviva	ibandronato	Roche
Prolia	denosumab	Amgen
Caltrate	carbonato de calcio	Pfizer
Rocaltrol	calcitriol	Roche
Estrace	estradiol
Premarin	estrógenos conjugados	Pfizer
Provera	medroxiprogesterona	Pfizer
Duphaston	dydrogesterona	Abbott
Utrogestan	progesterona	Besins
Clomid	clomifeno	Sanofi
Glucosamina	glucosamina
Celebra	celecoxib	Pfizer
Arthrotec	diclofenaco	Pfizer
Zaldiar	tramadol	Grünenthal
Palexia	tapentadol	Grünenthal
Durogesic	fentanilo	Janssen
Oxicontin	oxicodona	Mundipharma
Morfina	morfina
Sevredol	morfina	Mundipharma`;
