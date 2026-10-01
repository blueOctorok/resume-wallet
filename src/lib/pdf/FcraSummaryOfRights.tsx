/**
 * "A Summary of Your Rights Under the Fair Credit Reporting Act" — the CFPB's
 * standard consumer notice (12 CFR Part 1022, Appendix K). Appended to every
 * consumer-report PDF Storm renders (MVR today; PSP next) so an employer can
 * satisfy the FCRA pre-adverse-action requirement with the report alone, the
 * same way Key Background Screening's PDF does.
 *
 * The text is the regulator's form, reproduced verbatim — do not paraphrase it.
 * When the CFPB revises Appendix K, update the strings here in one place.
 */

import React from 'react'
import { Text, View } from '@react-pdf/renderer'
import { STORM_COLORS, stormPdfStyles } from '@/lib/pdf/StormPdfChrome'

const SPANISH_NOTICE =
  'Para información en español, visite www.consumerfinance.gov/learnmore o escribe a la Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.'

const INTRO =
  'The federal Fair Credit Reporting Act (FCRA) promotes the accuracy, fairness, and privacy of information in the files of consumer reporting agencies. There are many types of consumer reporting agencies, including credit bureaus and specialty agencies (such as agencies that sell information about check writing histories, medical records, and rental history records). Here is a summary of your major rights under FCRA. For more information, including information about additional rights, go to www.consumerfinance.gov/learnmore or write to: Consumer Financial Protection Bureau, 1700 G Street NW, Washington, DC 20552.'

interface RightItem {
  lead: string
  body: string
  sub?: string[]
  /** Paragraphs that follow the sub-list (used by the security-freeze item). */
  after?: string[]
}

const RIGHTS: RightItem[] = [
  {
    lead: 'You must be told if information in your file has been used against you.',
    body: 'Anyone who uses a credit report or another type of consumer report to deny your application for credit, insurance, or employment – or to take another adverse action against you – must tell you, and must give you the name, address, and phone number of the agency that provided the information.',
  },
  {
    lead: 'You have the right to know what is in your file.',
    body: 'You may request and obtain all the information about you in the files of a consumer reporting agency (your "file disclosure"). You will be required to provide proper identification, which may include your Social Security number. In many cases, the disclosure will be free. You are entitled to a free file disclosure if:',
    sub: [
      'a person has taken adverse action against you because of information in your credit report;',
      'you are the victim of identity theft and place a fraud alert in your file;',
      'your file contains inaccurate information as a result of fraud;',
      'you are on public assistance;',
      'you are unemployed but expect to apply for employment within 60 days.',
    ],
    after: [
      'In addition, all consumers are entitled to one free disclosure every 12 months upon request from each nationwide credit bureau and from nationwide specialty consumer reporting agencies. See www.consumerfinance.gov/learnmore for additional information.',
    ],
  },
  {
    lead: 'You have the right to ask for a credit score.',
    body: 'Credit scores are numerical summaries of your credit-worthiness based on information from credit bureaus. You may request a credit score from consumer reporting agencies that create scores or distribute scores used in residential real property loans, but you will have to pay for it. In some mortgage transactions, you will receive credit score information for free from the mortgage lender.',
  },
  {
    lead: 'You have the right to dispute incomplete or inaccurate information.',
    body: 'If you identify information in your file that is incomplete or inaccurate, and report it to the consumer reporting agency, the agency must investigate unless your dispute is frivolous. See www.consumerfinance.gov/learnmore for an explanation of dispute procedures.',
  },
  {
    lead: 'Consumer reporting agencies must correct or delete inaccurate, incomplete, or unverifiable information.',
    body: 'Inaccurate, incomplete, or unverifiable information must be removed or corrected, usually within 30 days. However, a consumer reporting agency may continue to report information it has verified as accurate.',
  },
  {
    lead: 'Consumer reporting agencies may not report outdated negative information.',
    body: 'In most cases, a consumer reporting agency may not report negative information that is more than seven years old, or bankruptcies that are more than 10 years old.',
  },
  {
    lead: 'Access to your file is limited.',
    body: 'A consumer reporting agency may provide information about you only to people with a valid need – usually to consider an application with a creditor, insurer, employer, landlord, or other business. The FCRA specifies those with a valid need for access.',
  },
  {
    lead: 'You must give your consent for reports to be provided to employers.',
    body: 'A consumer reporting agency may not give out information about you to your employer, or a potential employer, without your written consent given to the employer. Written consent generally is not required in the trucking industry. For more information, go to www.consumerfinance.gov/learnmore.',
  },
  {
    lead: 'You may limit "prescreened" offers of credit and insurance you get based on information in your credit report.',
    body: 'Unsolicited "prescreened" offers for credit and insurance must include a toll-free phone number you can call if you choose to remove your name and address from the lists these offers are based on. You may opt out with the nationwide credit bureaus at 1-888-567-8688.',
  },
  {
    lead: 'The following FCRA right applies with respect to nationwide consumer reporting agencies:',
    body: 'CONSUMERS HAVE THE RIGHT TO OBTAIN A SECURITY FREEZE',
    after: [
      'You have a right to place a "security freeze" on your credit report, which will prohibit a consumer reporting agency from releasing information in your credit report without your express authorization. The security freeze is designed to prevent credit, loans, and services from being approved in your name without your consent. However, you should be aware that using a security freeze to take control over who gets access to the personal and financial information in your credit report may delay, interfere with, or prohibit the timely approval of any subsequent request or application you make regarding a new loan, credit, mortgage, or any other account involving the extension of credit.',
      'As an alternative to a security freeze, you have the right to place an initial or extended fraud alert on your credit file at no cost. An initial fraud alert is a 1-year alert that is placed on a consumer\u2019s credit file. Upon seeing a fraud alert display on a consumer\u2019s credit file, a business is required to take steps to verify the consumer\u2019s identity before extending new credit. If you are a victim of identity theft, you are entitled to an extended fraud alert, which is a fraud alert lasting 7 years.',
      'A security freeze does not apply to a person or entity, or its affiliates, or collection agencies acting on behalf of the person or entity, with which you have an existing account that requests information in your credit report for the purposes of reviewing or collecting the account. Reviewing the account includes activities related to account maintenance, monitoring, credit line increases, and account upgrades and enhancements.',
    ],
  },
  {
    lead: 'You may seek damages from violators.',
    body: 'If a consumer reporting agency, or, in some cases, a user of consumer reports or a furnisher of information to a consumer reporting agency violates the FCRA, you may be able to sue in state or federal court.',
  },
  {
    lead: 'Identity theft victims and active duty military personnel have additional rights.',
    body: 'For more information, visit www.consumerfinance.gov/learnmore.',
  },
]

const STATE_ENFORCEMENT =
  'States may enforce the FCRA, and many states have their own consumer reporting laws. In some cases, you may have more rights under state law. For more information, contact your state or local consumer protection agency or your state Attorney General. For information about your federal rights, contact:'

interface AgencyRow {
  business: string
  contact: string
}

const AGENCY_TABLE: AgencyRow[] = [
  {
    business:
      '1.a. Banks, savings associations, and credit unions with total assets of over $10 billion and their affiliates\n\nb. Such affiliates that are not banks, savings associations, or credit unions also should list, in addition to the CFPB:',
    contact:
      'a. Consumer Financial Protection Bureau\n1700 G Street NW\nWashington, DC 20552\n\nb. Federal Trade Commission\nConsumer Response Center\n600 Pennsylvania Avenue NW\nWashington, DC 20580\n(877) 382-4357',
  },
  {
    business:
      '2. To the extent not included in item 1 above:\n\na. National banks, federal savings associations, and federal branches and federal agencies of foreign banks\n\nb. State member banks, branches and agencies of foreign banks (other than federal branches, federal agencies, and Insured State Branches of Foreign Banks), commercial lending companies owned or controlled by foreign banks, and organizations operating under section 25 or 25A of the Federal Reserve Act.\n\nc. Nonmember Insured Banks, Insured State Branches of Foreign Banks, and insured state savings associations\n\nd. Federal Credit Unions',
    contact:
      'a. Office of the Comptroller of the Currency\nCustomer Assistance Group\nP.O. Box 53570\nHouston, TX 77052\n\nb. Federal Reserve Consumer Help Center\nP.O. Box 1200\nMinneapolis, MN 55480\n\nc. Division of Depositor and Consumer Protection\nNational Center for Consumer and Depositor Assistance\nFederal Deposit Insurance Corporation\n1100 Walnut Street, Box #11\nKansas City, MO 64106\n\nd. National Credit Union Administration\nOffice of Consumer Financial Protection\n1775 Duke Street\nAlexandria, VA 22314',
  },
  {
    business: '3. Air carriers',
    contact:
      'Assistant General Counsel for Office of Aviation Consumer Protection\nDepartment of Transportation\n1200 New Jersey Avenue SE\nWashington, DC 20590',
  },
  {
    business: '4. Creditors Subject to the Surface Transportation Board',
    contact:
      'Office of Public Assistance, Governmental Affairs, and Compliance\nSurface Transportation Board\n395 E Street SW\nWashington, DC 20423',
  },
  {
    business: '5. Creditors Subject to the Packers and Stockyards Act, 1921',
    contact: 'Nearest Packers and Stockyards Division Regional Office',
  },
  {
    business: '6. Small Business Investment Companies',
    contact:
      'Associate Administrator, Office of Capital Access\nUnited States Small Business Administration\n409 Third Street SW, Suite 8200\nWashington, DC 20416',
  },
  {
    business: '7. Brokers and Dealers',
    contact: 'Securities and Exchange Commission\n100 F Street NE\nWashington, DC 20549',
  },
  {
    business: '8. Institutions that are members of the Farm Credit System',
    contact: 'Farm Credit Administration\n1501 Farm Credit Drive\nMcLean, VA 22102-5090',
  },
  {
    business: '9. Retailers, Finance Companies, and All Other Creditors Not Listed Above',
    contact:
      'Federal Trade Commission\nConsumer Response Center\n600 Pennsylvania Avenue NW\nWashington, DC 20580\n(877) 382-4357',
  },
]

const body = { fontSize: 8.5, color: STORM_COLORS.body, marginBottom: 6, lineHeight: 1.45 } as const
const bulletRow = { flexDirection: 'row', marginBottom: 6, paddingRight: 6 } as const
const bulletGlyph = { width: 10, fontSize: 8.5, color: STORM_COLORS.body } as const
const subRow = { flexDirection: 'row', marginLeft: 14, marginBottom: 2 } as const
const AGENCY_COLS = ['48%', '52%']

/** Renders the full Appendix K notice. Place it inside its own `<StormPdfPage>`. */
export function FcraSummaryOfRights() {
  return (
    <View>
      <Text style={{ ...body, fontStyle: 'italic', color: STORM_COLORS.muted }}>{SPANISH_NOTICE}</Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Helvetica-Bold',
          color: STORM_COLORS.ink,
          textAlign: 'center',
          marginVertical: 8,
        }}
      >
        A Summary of Your Rights Under the Fair Credit Reporting Act
      </Text>
      <Text style={body}>{INTRO}</Text>

      {RIGHTS.map((item) => (
        <View key={item.lead} wrap={false}>
          <View style={bulletRow}>
            <Text style={bulletGlyph}>•</Text>
            <Text style={{ ...body, marginBottom: 0, flex: 1 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{item.lead}</Text> {item.body}
            </Text>
          </View>
          {item.sub?.map((line) => (
            <View key={line} style={subRow}>
              <Text style={bulletGlyph}>o</Text>
              <Text style={{ ...body, marginBottom: 0, flex: 1 }}>{line}</Text>
            </View>
          ))}
          {item.after?.map((para) => (
            <Text key={para.slice(0, 40)} style={{ ...body, marginLeft: 10, marginTop: 4 }}>
              {para}
            </Text>
          ))}
        </View>
      ))}

      <Text style={{ ...body, marginTop: 4 }}>{STATE_ENFORCEMENT}</Text>

      <View style={stormPdfStyles.table}>
        <View style={stormPdfStyles.tableHeaderRow}>
          <Text style={[stormPdfStyles.tableHeaderCell, { width: AGENCY_COLS[0] }]}>TYPE OF BUSINESS</Text>
          <Text style={[stormPdfStyles.tableHeaderCell, { width: AGENCY_COLS[1] }]}>CONTACT</Text>
        </View>
        {AGENCY_TABLE.map((row, i) => (
          <View
            key={row.business.slice(0, 20)}
            style={[stormPdfStyles.tableRow, i % 2 === 1 ? stormPdfStyles.tableRowAlt : {}]}
            wrap={false}
          >
            <Text style={[stormPdfStyles.tableCell, { width: AGENCY_COLS[0] }]}>{row.business}</Text>
            <Text style={[stormPdfStyles.tableCell, { width: AGENCY_COLS[1] }]}>{row.contact}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}
