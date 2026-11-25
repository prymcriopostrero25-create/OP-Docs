from pathlib import Path
import json
staff='Staff - Office of the College President'
president='College President or Officer-in-Charge'
def step(client,action,time,person=staff): return dict(client=client,action=action,time=time,person=person)
def service(title,description,classification,eligible,requirements,steps,pages,internal=False):
 return dict(title=title,description=description,classification=classification,eligible=eligible,requirements=requirements,steps=steps,pages=pages,category='internal' if internal else 'external',requirementSource='Requesting personnel' if internal and pages=='19-20' else 'Requesting personnel or office' if internal else 'The client will provide')
s=[]
s.append(service('Processing of Action on Contracts and External Agreements','Action on projects and partnerships with external stakeholders through contracts and external agreements.','Complex','Government agencies, private organizations, academic institutions, and other external partners',[
'Letter request or communications (1 original copy).','Proposed contract, Memorandum of Agreement, Memorandum of Understanding, or other external agreement (1 copy for review).'],[
step('Submit the request letter and proposed contract or agreement.','Receive and check completeness, inform the client of missing requirements, record the complete submission, and issue an acknowledgment of receipt.','15 minutes'),
step('','Endorse to the College President for instructions and referral.','5 minutes'),
step('No additional action required.','Refer the proposed contract or agreement to the Legal Office for legal and technical evaluation.','4 working days','Legal Affairs and Services Office Director'),
step('','Evaluate recommendations and approve and sign within the President\'s authority, or issue written action indicating required revisions, further approval, or reasons for disapproval.','2 working days',president),
step('Receive the signed agreement or written action and acknowledge receipt.','Record and release the signed agreement or written action to the requesting party.','1 working hour')],'5-6'))
s.append(service('Processing of Requests for Appointments and Meetings with the College President','Walk-in or scheduled appointments and meetings with the College President, subject to availability.','Simple','College stakeholders, guests, and visitors',[
'For walk-in: valid identification card (1 original copy).','Letter or email stating the purpose, preferred date and time, names and number of attendees, and contact details (1 printed or electronic copy).','Appointment confirmation, email, or other notice of acceptance (1 electronic copy for presentation).'],[
step('Submit the written or emailed request; for walk-in requests, present a valid identification card.','Receive the request, check completeness, and record the purpose and contact details. For walk-ins, verify the identification card and return it immediately.','15 minutes'),
step('Await action on the request.','Check the availability of the College President or Officer-in-Charge.','15 minutes'),
step('','Refer the request to the College President or Officer-in-Charge for action or schedule confirmation.','5 minutes'),
step('Meet the President.','President or Officer-in-Charge meets the visitor.','2 working hours',president)],'7-8'))
s.append(service('Processing of Request from outside persons, agencies and different Colleges/Universities','Submission of requests from outside persons, agencies, colleges, offices, and university units through letters or communications.','Simple','Offices and/or units of different colleges and universities',[
'Letter request or communications (1 original copy).'],[
step('Submit the request (letter, communications, or email).','Receive request letters and communications from outside persons, agencies, colleges, offices, and university units.','15 minutes'),
step('','Check completeness of letters, communications, and submitted documents. Return incomplete submissions and inform the client of missing requirements.','10 minutes'),
step('','Forward complete letters or communications to the President or Officer-in-Charge for appropriate action.','5 minutes'),
step('','Approve or endorse to the Vice Presidents or appropriate officials concerned for action.','1 working hour',president),
step('Receive the action on the request.','Record letters or communications in the logbook and forward the approved letter or communication to the Records and Archives Office.','1 working day')],'9-10'))
s.append(service('Processing of Invitations to Official Activities','Processing of invitations received personally, by mail, or electronically for the President\'s participation, subject to availability and institutional priorities.','Simple','Government agencies, private organizations, educational institutions, and other inviting stakeholders',[
'Invitation letter indicating the activity\'s purpose, date, time, venue or online platform, requested participation, and contact details (1 original copy).','Activity program if the President is requested to deliver a message, serve as a resource speaker, or perform a specific role (1 copy).'],[
step('Submit the invitation and applicable supporting document personally or through the provided email address or official electronic channel.','Receive and check completeness, record the invitation, and acknowledge receipt personally or electronically. Inform the client of missing requirements through the provided contact details.','15 minutes'),
step('Await notification of the action taken.','Check the President\'s schedule and endorse for consideration.','15 minutes'),
step('','Decide on acceptance, decline, or designation of an authorized representative, as appropriate.','1 working day',president),
step('Receive the official response personally or through the provided email address or official electronic channel.','Prepare, record, and release or electronically transmit the response indicating acceptance, nonavailability, or the designated representative.','1 working day')],'11-12'))
s.append(service('Processing of Requests for Institutional Visits','Receipt, evaluation, and processing of requests for institutional visits, including benchmarking and educational visits, and communication of the action taken.','Complex','Educational institutions, government agencies, private organizations, and other interested stakeholders',[
'Request letter indicating the requesting institution, purpose and objectives, proposed date and time, offices or facilities to be visited, number of participants, and contact person\'s details.','Proposed visit agenda or list of discussion topics (1 printed or electronic copy; may be incorporated in the request letter).'],[
step('Submit the request and proposed agenda personally, through mail, or through the office\'s designated official electronic channels.','Receive the request letter, check required information, record the request, and acknowledge receipt personally or electronically.','15 minutes'),
step('','Endorse the request letter to the College President for evaluation and appropriate action.','5 minutes'),
step('Await action on the request.','Evaluate and issue instructions to approve, disapprove, or coordinate a proposed schedule with concerned offices.','2 working days',president),
step('','Carry out the President\'s instructions and coordinate with concerned offices to confirm schedule, personnel and facility availability, and visit arrangements.','2 working days'),
step('Receive the official response personally or electronically.','Prepare, record, and release or electronically transmit the official response. For approved visits, indicate the confirmed schedule, contact person, and arrangements. For disapproved requests, state the reason.','1 working day')],'13-14'))
s.append(service('Processing of Documents for Approval and Signature','Receipt, review, routing, and release of documents requiring the College President\'s approval and signature.','Simple','College officials and personnel',[
'Document bearing all required signatures and endorsements, with only the College President\'s approval and signature remaining (1 original copy).','Complete supporting documents prescribed for the specific document, when applicable (1 set).'],[
step('Submit the original document and required attachments.','Receive and check the document and attachments. Verify all required signatures and endorsements are complete, with only the President\'s approval and signature remaining. Inform the client of deficiencies.','15 minutes'),
step('','Endorse to the College President for approval and signature.','5 minutes'),
step('Await action on the request.','Evaluate and approve and sign, disapprove, or return with instructions for correction. State the reason for disapproval or return.','2 working days',president),
step('Claim the signed document or written action.','Record the action taken and release the signed document or written action to the requesting personnel or authorized representative.','1 working hour')],'15-16',True))
s.append(service('Processing of Requests for Official Issuances','Preparation, approval, and release of executive memoranda, special orders, travel orders, travel authority, and certification of travel upon request.','Simple','College officials, personnel, offices, and units',[
'Signed request letter specifying the issuance requested, purpose, concerned personnel, inclusive dates, and relevant instructions, bearing required endorsements (1 original copy).','Applicable supporting documents: approved activity proposal, invitation or notice, approved travel request, recommendation and endorsement (1 set, as applicable).'],[
step('Submit the signed request letter and applicable supporting documents.','Check completeness of the request, attachments, recommendations, and endorsements. Inform the client of deficiencies; otherwise record and acknowledge receipt.','15 minutes'),
step('','Endorse to the College President for consideration and instructions.','5 minutes'),
step('Await notification of the action taken.','Evaluate the request and authorize preparation of the issuance or indicate the reason for disapproval.','2 working days',president),
step('','Prepare and review the official issuance in accordance with the approved request and President\'s instructions. Forward for signature.','2 working days'),
step('','Review and sign the official issuance.','2 working hours',president),
step('Receive the official issuance.','Record and retain an office copy of the signed issuance, then forward to the Records and Archives Office for release and distribution to the requesting office and concerned personnel.','2 working hours')],'17-18',True))
s.append(service('Processing of Requests for Appointments and Meetings','Meetings on official matters for College officials and personnel through walk-in or scheduled appointments, subject to the President\'s availability.','Simple','College officials and personnel from all campuses, offices, and units',[
'Signed request letter indicating the purpose, preferred date and time, names of attendees, and contact details (1 original copy).','For walk-in: entry in the appointment logbook indicating the requesting personnel\'s name, office, and purpose of the meeting.'],[
step('Submit the request letter for a scheduled appointment or register in the appointment logbook for a walk-in request.','Receive and check required information, record the request, and acknowledge receipt.','15 minutes'),
step('','Check the President\'s calendar and endorse for consideration. For walk-in requests, check immediate availability.','5 minutes'),
step('Await advice on the request.','Evaluate and approve, decline, or provide an alternative schedule or appropriate instruction.','1 working day',president),
step('Receive confirmation or advice on the request.','Inform requesting personnel of the action taken. For approved requests, provide the confirmed date, time, and venue, and record the appointment in the President\'s calendar.','1 working hour')],'19-20',True))
Path('src/data').mkdir(exist_ok=True)
Path('src/data/citizenCharter.js').write_text('// Source: JH. Cerilles State College Citizen\'s Charter, 2026 edition, pages 5-20.\n// Descriptions and procedural wording are condensed; published requirements and step times are retained.\nexport const charterServices = '+json.dumps(s,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
