const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

let University;

function setUniversityModel(model) {
    University = model;
}

// Helper functions
function getDegreeType(degreeName) {
    if (degreeName.match(/Bachelor|BS|BBA|BSC|LLB|Bachelors/i)) return 'Undergraduate';
    if (degreeName.match(/Master|MS|MBA|MSC|Masters/i)) return 'Graduate';
    if (degreeName.match(/Doctor|PhD|Ph.D/i)) return 'Postgraduate';
    return 'Undergraduate';
}

function getDuration(degreeName) {
    if (degreeName.includes('LLB')) return '5 Years';
    if (degreeName.includes('PhD') || degreeName.includes('Doctor')) return '3-5 Years';
    return '4 Years';
}

// Create agent to ignore SSL certificate errors
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// ==================== FAST SCRAPER - FULLY DYNAMIC ====================
async function scrapeFAST() {
    try {
        console.log('🌐 Fetching LIVE data from FAST website...');
        const response = await axios.get('https://www.nu.edu.pk/Degree-Programs', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000,
            httpsAgent: httpsAgent
        });
        const $ = cheerio.load(response.data);
        const programs = [];
        
        // EXTRACT CAMPUSES DYNAMICALLY from table headers
        const campuses = [];
        $('table thead tr th').each((i, th) => {
            const campusName = $(th).text().trim();
            // Filter out non-campus headers
            if (campusName && 
                campusName !== 'Program' && 
                campusName !== 'Degree' && 
                !campusName.includes('Program') &&
                campusName.length > 2 && 
                campusName.length < 30) {
                campuses.push(campusName);
            }
        });
        
        let currentDepartment = '';
        
        // EXTRACT PROGRAMS DYNAMICALLY from table rows
        $('table tbody tr').each((i, elem) => {
            // Check for department headers (rows with colspan)
            if ($(elem).find('td[colspan]').length) {
                const deptText = $(elem).find('h4 strong, h4, strong').text().trim();
                if (deptText) {
                    currentDepartment = deptText;
                }
                return;
            }
            
            // Extract program name
            let programName = '';
            $(elem).find('td').each((j, td) => {
                const text = $(td).text().trim();
                if (text && text.length > 3 && text.length < 150 && !text.includes('✓') && !text.includes('✗')) {
                    // Check if this cell contains program name (first column usually)
                    if (j === 0 || $(td).find('a').length) {
                        programName = text;
                    }
                }
            });
            
            if (programName) {
                // Extract which campuses offer this program
                const availableCampuses = [];
                $(elem).find('td').each((j, td) => {
                    const hasCheckmark = $(td).find('.fa-check, a[class*="check"], [class*="tick"]').length > 0 || 
                                       $(td).html()?.includes('fa-check') ||
                                       $(td).text().includes('✓');
                    if (hasCheckmark && campuses[j - 1]) {
                        availableCampuses.push(campuses[j - 1]);
                    }
                });
                
                programs.push({
                    university: 'FAST National University (NUCES)',
                    degree: programName,
                    campuses: availableCampuses,
                    degreeType: getDegreeType(programName),
                    duration: getDuration(programName)
                });
            }
        });
        
        if (programs.length === 0) {
            console.log(`❌ FAST: No programs found on live website`);
            return [];
        }
        
        console.log(`✅ FAST: ${programs.length} programs | Campuses: ${campuses.join(', ')}`);
        return programs;
        
    } catch (error) {
        console.error(`❌ FAST: Failed to fetch - ${error.message}`);
        return [];
    }
}

// ==================== NUST SCRAPER - HARDCODED PROGRAMS ====================
async function scrapeNUST() {
    try {
        console.log('📝 Using HARDCODED data for NUST...');
        
        // NUST campuses
        const nustCampuses = ['Islamabad', 'Rawalpindi', 'Karachi', 'Lahore', 'Quetta', 'Peshawar'];
        
        // Hardcoded NUST programs
        const hardcodedPrograms = [
            { degree: 'BE Geoinformatics Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Environmental Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Civil Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Environmental Science', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Electrical Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Computer Science', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Software Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Mechanical Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BBA', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Economics', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Mathematics', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Physics', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Chemistry', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Aerospace Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BE Materials Engineering', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Architecture', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '5 Years' },
            { degree: 'BS Mass Communication', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' },
            { degree: 'BS Psychology', campuses: ['Islamabad'], degreeType: 'Undergraduate', duration: '4 Years' }
        ];
        
        const programs = hardcodedPrograms.map(program => ({
            university: 'National University of Sciences & Technology (NUST)',
            degree: program.degree,
            campuses: program.campuses,
            degreeType: program.degreeType,
            duration: program.duration
        }));
        
        console.log(`✅ NUST: ${programs.length} programs (HARDCODED) | Campuses: ${nustCampuses.join(', ')}`);
        return programs;
        
    } catch (error) {
        console.error(`❌ NUST: Failed - ${error.message}`);
        return [];
    }
}

// ==================== COMSATS SCRAPER - FULLY DYNAMIC ====================
// ==================== COMSATS SCRAPER - WITH CAMPUS FROM EXPANDED CONTENT ====================
async function scrapeCOMSATS() {
    try {
        console.log('🌐 Fetching LIVE data from COMSATS website...');
        const response = await axios.get('https://admissions.comsats.edu.pk/Home/ProgramDetails', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000,
            httpsAgent: httpsAgent
        });
        const $ = cheerio.load(response.data);
        const programs = [];
        
        // Track program links and their corresponding panel IDs
        const programLinks = [];
        
        // First, collect all program links with their panel IDs
        $('a[href*="panel-element"]').each((i, elem) => {
            let text = $(elem).text().trim();
            const href = $(elem).attr('href');
            const panelId = href.replace('#', '');
            
            // Skip empty or invalid links
            if (text && text.length > 5 && text.length < 150 && !text.includes('Element') && text !== '+') {
                programLinks.push({
                    name: text,
                    panelId: panelId
                });
            }
        });
        
        console.log(`Found ${programLinks.length} program links`);
        
        // Process each program and extract campuses from its expanded panel
        for (const program of programLinks) {
            let degree = '';
            let degreeType = '';
            let duration = '4 Years';
            let campuses = new Set();
            
            // Determine degree type from the program name
            if (program.name.includes('Bachelor') || program.name.includes('BS') || 
                program.name.includes('BSc') || program.name.includes('BBA') ||
                program.name.includes('Bachelors')) {
                degreeType = 'Undergraduate';
                duration = '4 Years';
            } else if (program.name.includes('Master') || program.name.includes('MS') || 
                       program.name.includes('MSc') || program.name.includes('MBA')) {
                degreeType = 'Graduate';
                duration = '2 Years';
            } else if (program.name.includes('PhD') || program.name.includes('Doctor')) {
                degreeType = 'Postgraduate';
                duration = '3-5 Years';
            } else {
                degreeType = 'Undergraduate';
                duration = '4 Years';
            }
            
            // Clean the degree name (remove + sign and extra spaces)
            degree = program.name.replace(/^\+ /, '').trim();
            degree = degree.replace(/\s+/g, ' ').trim();
            
            // Look for the panel content that contains campus information
            const panelContent = $(`#${program.panelId}`);
            if (panelContent.length) {
                const panelText = panelContent.text();
                
                // Extract campus names from the panel text
                // Look for "Offering Campuses" section
                const offeringCampusesMatch = panelText.match(/Offering\s*Campuses?[\s\S]*?(?=\n\n|$)/i);
                if (offeringCampusesMatch) {
                    const campusSection = offeringCampusesMatch[0];
                    // Extract campus names from the section
                    const campusRegex = /(Islamabad|Lahore|Abbottabad|Wah|Sahiwal|Attock|Vehari|Karachi|Rawalpindi|Peshawar|Quetta)/gi;
                    let campusMatch;
                    while ((campusMatch = campusRegex.exec(campusSection)) !== null) {
                        if (campusMatch[1]) {
                            campuses.add(campusMatch[1]);
                        }
                    }
                }
                
                // Also look for "More details" pattern which indicates campus offerings
                const moreDetailsMatch = panelText.match(/(Islamabad|Lahore|Abbottabad|Wah|Sahiwal|Attock|Vehari)\s*\(More details\)/gi);
                if (moreDetailsMatch) {
                    moreDetailsMatch.forEach(match => {
                        const campusRegex = /(Islamabad|Lahore|Abbottabad|Wah|Sahiwal|Attock|Vehari)/i;
                        const campusMatch = campusRegex.exec(match);
                        if (campusMatch) {
                            campuses.add(campusMatch[1]);
                        }
                    });
                }
                
                // If no campuses found in Offering Campuses section, search entire panel text
                if (campuses.size === 0) {
                    const campusRegex = /(Islamabad|Lahore|Abbottabad|Wah|Sahiwal|Attock|Vehari)/gi;
                    let campusMatch;
                    while ((campusMatch = campusRegex.exec(panelText)) !== null) {
                        if (campusMatch[1] && !panelText.includes('Landscape') && !panelText.includes('landscape')) {
                            campuses.add(campusMatch[1]);
                        }
                    }
                }
            }
            
            // If still no campuses found, add default campus
            if (campuses.size === 0) {
                campuses.add('Islamabad');
            }
            
            programs.push({
                university: 'COMSATS University Islamabad',
                degree: degree,
                campuses: [...campuses].sort(),
                degreeType: degreeType,
                duration: duration
            });
        }
        
        // Remove duplicates (same degree name)
        const uniquePrograms = [];
        const seen = new Set();
        for (const program of programs) {
            const key = program.degree.toLowerCase().replace(/\s+/g, ' ').trim();
            if (!seen.has(key) && program.degree.length > 5 && program.degree.length < 150) {
                seen.add(key);
                uniquePrograms.push(program);
            }
        }
        
        if (uniquePrograms.length === 0) {
            console.log(`❌ COMSATS: No programs found on live website`);
            return [];
        }
        
        // Sort programs
        uniquePrograms.sort((a, b) => {
            const order = { 'Undergraduate': 1, 'Graduate': 2, 'Postgraduate': 3 };
            return (order[a.degreeType] || 4) - (order[b.degreeType] || 4);
        });
        
        console.log(`✅ COMSATS: ${uniquePrograms.length} programs with campus-specific data`);
        
        // Log a sample to verify
        if (uniquePrograms.length > 0) {
            console.log(`   Sample: ${uniquePrograms[0].degree} -> Campuses: ${uniquePrograms[0].campuses.join(', ')}`);
        }
        
        return uniquePrograms;
        
    } catch (error) {
        console.error(`❌ COMSATS: Failed to fetch - ${error.message}`);
        return [];
    }
}

// ==================== UCP SCRAPER - ONLY CAMPUS HARDCODED (Lahore) ====================
async function scrapeUCP() {
    try {
        console.log('🌐 Fetching LIVE data from UCP website...');
        const response = await axios.get('https://ucp.edu.pk/undergraduate/', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000,
            httpsAgent: httpsAgent
        });
        const $ = cheerio.load(response.data);
        const programs = [];
        
        const ucpCampuses = ['Lahore'];
        let programFound = false;
        
        // Dynamic table extraction
        $('table').each((i, table) => {
            $(table).find('tr').each((j, row) => {
                const cells = $(row).find('td, th');
                if (cells.length >= 1) {
                    const cellTexts = [];
                    cells.each((k, cell) => {
                        let text = $(cell).text().trim();
                        if (text && text.length > 0) {
                            cellTexts.push(text);
                        }
                    });
                    
                    let programName = '';
                    
                    for (let k = 0; k < cellTexts.length; k++) {
                        const text = cellTexts[k];
                        if (text.match(/Bachelor|BS|BSc|BBA|BSCS|BSSE|Program|Degree|Computer Science|Software Engineering|Business|Accounting|Finance/i)) {
                            programName = text;
                            programFound = true;
                            break;
                        }
                    }
                    
                    if (programName && !programs.some(p => p.degree === programName)) {
                        programs.push({
                            university: 'University of Central Punjab (UCP)',
                            degree: programName,
                            campuses: [...ucpCampuses],
                            degreeType: getDegreeType(programName),
                            duration: '4 Years'
                        });
                    }
                }
            });
        });
        
        // Dynamic extraction from program cards/divs
        if (!programFound) {
            $('.programme, .course, .degree, .card, .program-item, .course-item').each((i, elem) => {
                const title = $(elem).find('h2, h3, h4, h5, .title, .programme-title, .degree-title').first().text().trim();
                
                if (title && title.length > 5 && title.length < 100) {
                    if (title.match(/Bachelor|BS|BSc|BBA|BSCS|BSSE|Program|Degree|Computer|Software|Business|Accounting|Finance/i)) {
                        if (!programs.some(p => p.degree === title)) {
                            programs.push({
                                university: 'University of Central Punjab (UCP)',
                                degree: title,
                                campuses: [...ucpCampuses],
                                degreeType: getDegreeType(title),
                                duration: '4 Years'
                            });
                            programFound = true;
                        }
                    }
                }
            });
        }
        
        // Dynamic extraction from links
        $('a[href*="program"], a[href*="degree"], a[href*="course"]').each((i, elem) => {
            let text = $(elem).text().trim();
            if (text && text.length > 5 && text.length < 100 && !programs.some(p => p.degree === text)) {
                if (text.match(/Bachelor|BS|BSc|BBA|BSCS|BSSE|Computer|Software|Business|Accounting|Finance/i)) {
                    programs.push({
                        university: 'University of Central Punjab (UCP)',
                        degree: text,
                        campuses: [...ucpCampuses],
                        degreeType: getDegreeType(text),
                        duration: '4 Years'
                    });
                    programFound = true;
                }
            }
        });
        
        if (!programFound || programs.length === 0) {
            console.log(`❌ UCP: No programs found on live website`);
            return [];
        }
        
        // Remove duplicates
        const uniquePrograms = [];
        const seen = new Set();
        for (const program of programs) {
            const key = program.degree.toLowerCase().substring(0, 50);
            if (!seen.has(key)) {
                seen.add(key);
                uniquePrograms.push(program);
            }
        }
        
        console.log(`✅ UCP: ${uniquePrograms.length} programs | Campus: ${ucpCampuses.join(', ')}`);
        return uniquePrograms;
        
    } catch (error) {
        console.error(`❌ UCP: Failed to fetch - ${error.message}`);
        return [];
    }
}

// ==================== LUMS SCRAPER - UNDERGRADUATE ONLY ====================
async function scrapeLUMS() {
    try {
        console.log('🌐 Fetching LIVE data from LUMS website...');
        const response = await axios.get('https://lums.edu.pk/undergraduate', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000,
            httpsAgent: httpsAgent
        });
        const $ = cheerio.load(response.data);
        const programs = [];
        
        // LUMS only has Lahore campus
        const lumsCampuses = ['Lahore'];
        
        // Extract programs from links that point to /programmes/
        $('a[href*="/programmes/"]').each((i, elem) => {
            let programName = $(elem).text().trim();
            const href = $(elem).attr('href');
            
            // Skip empty or non-program links
            if (programName && programName.length > 5 && programName.length < 100 && 
                !programName.includes('Read More') && 
                !programName.includes('Programme Finder') &&
                !programName.includes('Undergraduate') &&
                !programName.includes('Graduate')) {
                
                // Clean up the program name
                programName = programName.replace(/\s+/g, ' ').trim();
                
                // Only include undergraduate programs (4 years)
                // Skip graduate and PhD programs
                if (!programName.match(/Master|MS|MBA|MSc|PhD|Doctor|Graduate/i)) {
                    
                    let duration = '4 Years';
                    
                    // LLB is 5 years, but still undergraduate
                    if (programName.includes('BA-LL.B') || programName.includes('LLB')) {
                        duration = '5 Years';
                    }
                    
                    programs.push({
                        university: 'Lahore University of Management Sciences (LUMS)',
                        degree: programName,
                        campuses: [...lumsCampuses],
                        degreeType: 'Undergraduate',
                        duration: duration
                    });
                }
            }
        });
        
        // Also extract from list items that contain program info
        $('li').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text && text.length > 10 && text.length < 100) {
                // Look for undergraduate program patterns
                if (text.match(/BSc \(Honours\)|BA \(Honours\)|BS |BA-LL.B/) && 
                    !text.match(/Master|MS|MBA|MSc|PhD|Doctor|Graduate/i)) {
                    
                    if (!programs.some(p => p.degree === text)) {
                        let duration = '4 Years';
                        if (text.includes('BA-LL.B')) {
                            duration = '5 Years';
                        }
                        
                        programs.push({
                            university: 'Lahore University of Management Sciences (LUMS)',
                            degree: text,
                            campuses: [...lumsCampuses],
                            degreeType: 'Undergraduate',
                            duration: duration
                        });
                    }
                }
            }
        });
        
        // Remove duplicates
        const uniquePrograms = [];
        const seen = new Set();
        for (const program of programs) {
            const key = program.degree.toLowerCase().replace(/\s+/g, ' ').trim();
            if (!seen.has(key) && program.degree.length > 5 && program.degree.length < 100) {
                seen.add(key);
                uniquePrograms.push(program);
            }
        }
        
        // Sort programs alphabetically
        uniquePrograms.sort((a, b) => a.degree.localeCompare(b.degree));
        
        console.log(`✅ LUMS: ${uniquePrograms.length} undergraduate programs | Campus: ${lumsCampuses.join(', ')}`);
        
        // Log sample to verify
        if (uniquePrograms.length > 0) {
            console.log(`   Sample: ${uniquePrograms[0].degree} (${uniquePrograms[0].duration})`);
        }
        
        return uniquePrograms;
        
    } catch (error) {
        console.error(`❌ LUMS: Failed to fetch - ${error.message}`);
        return [];
    }
}

// ==================== GIKI SCRAPER - FULLY DYNAMIC (NO FALLBACK) ====================
async function scrapeGIKI() {
    try {
        console.log('🌐 Fetching LIVE data from GIKI website...');
        const response = await axios.get('https://giki.edu.pk/programs/', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 15000,
            httpsAgent: httpsAgent
        });
        const $ = cheerio.load(response.data);
        const programs = [];
        
        const gikiCampuses = ['Topi'];
        
        // Extract programs from all links
        $('a').each((i, elem) => {
            let text = $(elem).text().trim();
            const href = $(elem).attr('href');
            
            // Only process links with program-related URLs
            if (href && (href.includes('undergraduate') || href.includes('graduate')) && text && text.length > 2 && text.length < 50) {
                // Skip non-program links
                const skipWords = ['Faculty', 'Department', 'School', 'Fee', 'Admission', 'Eligibility', 'Criteria', 'Newsletter', 'SDG'];
                let shouldSkip = false;
                for (const word of skipWords) {
                    if (text.includes(word)) {
                        shouldSkip = true;
                        break;
                    }
                }
                
                if (!shouldSkip) {
                    // Determine degree type and duration based on URL
                    let degreeType = 'Undergraduate';
                    let duration = '4 Years';
                    
                    if (href.includes('graduate')) {
                        degreeType = 'Graduate';
                        duration = '2 Years';
                    }
                    
                    // Clean up the program name
                    let degree = text;
                    
                    // Add appropriate prefix based on degree type and program name
                    if (degreeType === 'Undergraduate') {
                        if (text.match(/Engineering$/i) && !text.match(/^BE|^BS/i)) {
                            degree = `BE ${text}`;
                        } else if (!text.match(/^BS|^BE|^BSc|^BBA/i)) {
                            degree = `BS ${text}`;
                        }
                    } else if (degreeType === 'Graduate') {
                        if (text.match(/Engineering$/i) && !text.match(/^MS|^MSc/i)) {
                            degree = `MS ${text}`;
                        } else if (!text.match(/^MS|^MSc|^MBA/i)) {
                            degree = `MS ${text}`;
                        }
                    }
                    
                    programs.push({
                        university: 'Ghulam Ishaq Khan Institute (GIKI)',
                        degree: degree,
                        campuses: [...gikiCampuses],
                        degreeType: degreeType,
                        duration: duration
                    });
                }
            }
        });
        
        // Also look for program information in headings near the links
        $('h3').each((i, elem) => {
            const headingText = $(elem).text().trim();
            if (headingText === 'BS' || headingText === 'MS' || headingText === 'PhD') {
                const parentSection = $(elem).closest('div, section');
                let degreeType = 'Undergraduate';
                let duration = '4 Years';
                
                if (headingText === 'MS') {
                    degreeType = 'Graduate';
                    duration = '2 Years';
                } else if (headingText === 'PhD') {
                    degreeType = 'Postgraduate';
                    duration = '3-5 Years';
                }
                
                // Find program links under this heading
                parentSection.find('a').each((j, link) => {
                    let text = $(link).text().trim();
                    if (text && text.length > 2 && text.length < 50 && !text.match(/Faculty|Department|School|Fee|Admission|Eligibility/i)) {
                        let degree = text;
                        if (headingText === 'BS' && !text.match(/^BS|^BSc|^BBA/i)) {
                            degree = `BS ${text}`;
                        } else if (headingText === 'MS' && !text.match(/^MS|^MSc|^MBA/i)) {
                            degree = `MS ${text}`;
                        } else if (headingText === 'PhD' && !text.match(/^PhD/i)) {
                            degree = `PhD ${text}`;
                        }
                        
                        if (!programs.some(p => p.degree === degree)) {
                            programs.push({
                                university: 'Ghulam Ishaq Khan Institute (GIKI)',
                                degree: degree,
                                campuses: [...gikiCampuses],
                                degreeType: degreeType,
                                duration: duration
                            });
                        }
                    }
                });
            }
        });
        
        // Remove duplicates
        const uniquePrograms = [];
        const seen = new Set();
        for (const program of programs) {
            const key = program.degree.toLowerCase().trim();
            if (!seen.has(key)) {
                seen.add(key);
                uniquePrograms.push(program);
            }
        }
        
        if (uniquePrograms.length === 0) {
            console.log(`❌ GIKI: No programs found on live website`);
            return [];
        }
        
        console.log(`✅ GIKI: ${uniquePrograms.length} programs | Campus: ${gikiCampuses.join(', ')}`);
        return uniquePrograms;
        
    } catch (error) {
        console.error(`❌ GIKI: Failed to fetch - ${error.message}`);
        return [];
    }
}

// Helper function for GIKI duration
function getGIKIDuration(degreeName) {
    if (degreeName.includes('PhD') || degreeName.includes('Doctor')) return '3-5 Years';
    if (degreeName.includes('MS') || degreeName.includes('MSc') || degreeName.includes('ME') || degreeName.includes('Master')) return '2 Years';
    if (degreeName.includes('LLB')) return '5 Years';
    return '4 Years';
}


// ==================== MAIN FUNCTION ====================
async function scrapeAllUniversities() {
    if (!University) {
        throw new Error('University model not set. Call setUniversityModel first.');
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('🌐 LIVE WEB SCRAPING - DYNAMIC EXTRACTION');
    console.log('='.repeat(70) + '\n');
    
    const allPrograms = [];
    const failedUniversities = [];
    const results = {};
    
    // Scrape FAST
    results.FAST = await scrapeFAST();
    if (results.FAST.length > 0) allPrograms.push(...results.FAST);
    else failedUniversities.push('FAST');
    
    // Scrape NUST (HARDCODED)
    results.NUST = await scrapeNUST();
    if (results.NUST.length > 0) allPrograms.push(...results.NUST);
    else failedUniversities.push('NUST');
    
    // Scrape COMSATS
    results.COMSATS = await scrapeCOMSATS();
    if (results.COMSATS.length > 0) allPrograms.push(...results.COMSATS);
    else failedUniversities.push('COMSATS');
    
    // Scrape UCP
    results.UCP = await scrapeUCP();
    if (results.UCP.length > 0) allPrograms.push(...results.UCP);
    else failedUniversities.push('UCP');
    
    // Scrape LUMS
    results.LUMS = await scrapeLUMS();
    if (results.LUMS.length > 0) allPrograms.push(...results.LUMS);
    else failedUniversities.push('LUMS');
    
    // Scrape GIKI
    results.GIKI = await scrapeGIKI();
    if (results.GIKI.length > 0) allPrograms.push(...results.GIKI);
    else failedUniversities.push('GIKI');
    
    console.log('\n' + '='.repeat(70));
    
    if (allPrograms.length === 0) {
        console.log('❌ NO DATA SCRAPED - All universities failed!');
        console.log('   Check your internet connection and try again.');
        return { success: false, error: 'No data scraped from any university', programs: [] };
    }
    
    console.log(`✅ TOTAL: ${allPrograms.length} programs scraped successfully`);
    
    if (failedUniversities.length > 0) {
        console.log(`⚠️ Failed to scrape: ${failedUniversities.join(', ')}`);
    }
    
    console.log('='.repeat(70) + '\n');
    
    // Save to database
    await University.deleteMany({});
    await University.insertMany(allPrograms);
    console.log('💾 Database updated successfully!\n');
    
    // Print summary
    console.log('📋 SUMMARY:');
    for (const [uni, programs] of Object.entries(results)) {
        if (programs.length > 0) {
            const campuses = new Set();
            programs.forEach(p => p.campuses.forEach(c => campuses.add(c)));
            console.log(`   🏛️ ${uni}: ${programs.length} programs | Campuses: ${[...campuses].join(', ')}`);
        }
    }
    
    return { success: true, count: allPrograms.length, programs: allPrograms };
}
module.exports = { scrapeAllUniversities, setUniversityModel };